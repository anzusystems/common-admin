import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { type EffectScope, effectScope, ref, toRaw } from 'vue'
import axios from 'axios'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDamAnswer } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueItemTypeType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { createUploadQueueCore } from '@/domains/dam/uploadQueue/core/uploadQueueCore'
import type { UploadQueueCore, UploadQueueSettlementProfile } from '@/domains/dam/uploadQueue/core/uploadQueueCoreTypes'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import {
  adminDamImportRun,
  adminDamQueuePreset,
  libraryQueuePreset,
} from '@/domains/dam/uploadQueue/presets/queuePresets'
import {
  type UploadProgressCallback,
  type UploadRun,
  uploadSide,
} from '@/domains/dam/uploadQueue/presets/uploadPresets'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import {
  damProfile,
  fakeDamServer,
  type FakeDamServer,
  libProfile,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/settlementFixtures'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import type { UploadSettlementProfile } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'

// The core of an upload queue under each of its two sets, as each store hands it in. The library's runs every row
// by the library's upload, so its runs send to a fake DAM that records them and holds every chunk until the test
// lets it go. admin-dam's store hands in its own runs; here they are runs the test drives. The settlement of both
// asks the readers of its profile, a fake server, and its time is the manual scheduler's. Ids are taken from the
// rows, never from the order the runs started in.

const S = 1000
const QUEUE = 'queue'
const OTHER = 'other'
const { Waiting, Uploading, Processing, Uploaded, Failed, Stop } = UploadQueueItemStatus

/** How a run fails: before its finish request went out, or after; then answered with an error, or refused (4xx). */
type Failure = 'beforeFinish' | 'afterFinish' | 'finishRefused'

/** The run of one row, as the test drives it. */
interface Run {
  /** The file is all sent and its finish answered. */
  succeed(): Promise<void>
  /** The run fails; admin-dam's store makes `text` of what it failed with. */
  fail(how: Failure, text?: string): Promise<void>
  /** The run was told to stop. */
  stopped(): boolean
  /** The request of the chunk on its way was cancelled. */
  cancelled(): boolean
  /** admin-dam: the run reports how far it is, as the service reports it to the callback it was handed. */
  report(progress: number, speed: number, estimate: number): void
}

/** A store with the core of one side. */
interface Side {
  core: UploadQueueCore
  /** A row of a file, added as the store adds it: keyed by the core, made, and handed to `addRow`. */
  add(queueKey: UploadQueueKey, type?: UploadQueueItemTypeType): UploadQueueItem
  /** The run of a row, once it has started. */
  run(row: UploadQueueItem): Promise<Run>
  /** admin-dam's store: what its hooks were told, `queue/key` each, and the alerts it showed. */
  tracked: string[]
  removed: string[]
  alerts: Array<{ text: string; row: { status: string; message: string } }>
  /** admin-dam's store: what it was asked the text of, and how the failed row was then. */
  asked: Array<{ text: string; row: { status: string; message: string; hasError: boolean } }>
  /** admin-dam's store: which runner each row was given, `upload/key` or `import/key`. */
  runners: string[]
  /** What the settlement told the hook of the profile of a refresh: `+key` when one may help, `-key` when not. */
  refreshTold: string[]
  end(): void
}

let clock: ManualScheduler
let server: FakeDamServer
let scope: EffectScope
const realScheduler = uploadSettlementRuntime.scheduler

/** What the code under test does after an answer: a few turns of the event loop, the time standing. */
const settled = async () => {
  for (let turn = 0; turn < 5; turn++) await clock.settle()
}

/** The profile of a store, without its queues: the core hands the settlement its own. */
const coreProfile = (profile: UploadSettlementProfile): UploadQueueSettlementProfile => {
  const own: Partial<UploadSettlementProfile> = { ...profile }
  delete own.queues
  return own as UploadQueueSettlementProfile
}

const fileRow = (key: string, type: UploadQueueItemTypeType, licence: number) => {
  const item = useUploadQueueItemFactory().createDefault(key, type, Waiting, DamAssetType.Image, 1024, licence)
  item.file = new File([new Uint8Array(3000)], `${key}.jpg`, { type: 'image/jpeg' })
  return item
}

/** The library's store: its rows sent by the library's upload to a DAM whose chunks wait for the test. */
function librarySide(): Side {
  const dam = createFakeDam(cmsConfiguration.endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  const chunks = dam.hold('POST', dam.routes.chunk)
  const finishAnswers = new Map<string, FakeDamAnswer>()
  dam.reply((request) => {
    const finish = request.method === 'PATCH' ? request.url.match(dam.routes.finish) : null
    return finish ? finishAnswers.get(finish[1]!) : undefined
  })
  const queues = ref(new Map<UploadQueueKey, UploadQueue>())
  const profile = libProfile(server)
  const core = scope.run(() =>
    createUploadQueueCore(libraryQueuePreset({ queues, settlement: coreProfile(profile.profile) }))
  )!
  const chunkOf = (row: UploadQueueItem) =>
    chunks.waiting.find((held) => !!row.fileId && held.request.url.includes(`/${row.fileId}/chunk`))
  const finishSent = (row: UploadQueueItem) =>
    dam.sentTo('PATCH', dam.routes.finish).some((request) => request.url.includes(`/${row.fileId}/`))

  return {
    core,
    add: (queueKey, type = UploadQueueItemType.File) => {
      core.addRow(queueKey, fileRow(core.uniqueKey('file'), type, cmsConfiguration.licence))
      return core.getQueueItems(queueKey).at(-1)!
    },
    run: async (row) => {
      await vi.waitFor(() => expect(chunkOf(row)).toBeDefined(), { timeout: 5_000 })
      const held = chunkOf(row)!
      const signal = held.request.config.signal as AbortSignal
      return {
        succeed: async () => {
          held.release()
          await vi.waitFor(() => expect(finishSent(row)).toBe(true))
          await settled()
        },
        fail: async (how) => {
          // A run that was stopped has failed by itself: its chunk was cancelled.
          if (!signal.aborted) {
            if (how === 'beforeFinish') {
              // Every try of the chunk is answered with an error that is no refusal: the upload gives up before its
              // finish request. The pauses between the tries are let pass at once.
              const pauses = holdLongWaits(10_000, { passFrom: 1_000 })
              try {
                for (let attempt = 1; attempt <= 4; attempt++) {
                  await vi.waitFor(() => expect(chunkOf(row)).toBeDefined())
                  chunkOf(row)!.release({ status: 503 })
                }
              } finally {
                pauses.restore()
              }
            } else {
              finishAnswers.set(row.fileId!, { status: how === 'finishRefused' ? 403 : 500 })
              held.release()
              await vi.waitFor(() => expect(finishSent(row)).toBe(true))
            }
          }
          await settled()
        },
        stopped: () => signal.aborted,
        cancelled: () => signal.aborted,
        report: () => {
          throw new Error('The run of the library reports by its own meter.')
        },
      }
    },
    tracked: [],
    removed: [],
    alerts: [],
    asked: [],
    runners: [],
    refreshTold: profile.calls.refreshMayHelp,
    end: () => [QUEUE, OTHER].forEach((queueKey) => core.stopUpload(queueKey)),
  }
}

interface DrivenRun {
  stops: number
  finishAttempted: boolean
  resolve(): void
  reject(error: unknown): void
  onProgress?: UploadProgressCallback
}

/** admin-dam's store: its runs are the test's, and it records what its hooks are told. */
function adminDamSide(): Side {
  const queues = ref<Record<UploadQueueKey, UploadQueue>>({})
  const runs = new Map<UploadQueueItem, DrivenRun>()
  let started = 0
  /** The row whose run failed last: the store's text and alert are about it. */
  let failing: UploadQueueItem | null = null
  const side = {
    tracked: [] as string[],
    removed: [] as string[],
    alerts: [] as Side['alerts'],
    asked: [] as Side['asked'],
    runners: [] as string[],
  }
  const drive = (item: UploadQueueItem, onProgress?: UploadProgressCallback) => {
    const run: DrivenRun = { stops: 0, finishAttempted: false, resolve: () => {}, reject: () => {}, onProgress }
    const done = new Promise<void>((resolve, reject) => {
      run.resolve = resolve
      run.reject = reject
    })
    runs.set(toRaw(item), run)
    return { run, done }
  }
  // As the service: the row is being sent from its start on, and the start gives it its asset and its file.
  const begin = (item: UploadQueueItem) => {
    item.status = Uploading
    started++
    item.assetId = `asset-${started}`
    item.fileId = `file-${started}`
    item.latestChunkAbortController = new AbortController()
  }
  const profile = damProfile(server)
  const preset = adminDamQueuePreset({
    queues,
    settlement: coreProfile(profile.profile),
    upload: (item, onProgress): UploadRun<'adminDam'> => {
      side.runners.push(`upload/${item.key}`)
      const { run, done } = drive(item, onProgress)
      return {
        [uploadSide]: 'adminDam',
        uploadInit: () => {
          begin(item)
          return Promise.resolve(item)
        },
        upload: () => done,
        stop: () => run.stops++,
        finishAttempted: () => run.finishAttempted,
      }
    },
    importRun: (item) => {
      side.runners.push(`import/${item.key}`)
      const { done } = drive(item)
      return adminDamImportRun(() => {
        begin(item)
        return done
      })
    },
    failureMessage: (error) => {
      const text = (error as Error).message
      side.asked.push({
        text,
        row: { status: failing!.status, message: failing!.error.message, hasError: failing!.error.hasError },
      })
      return text
    },
    alert: (text) => side.alerts.push({ text, row: { status: failing!.status, message: failing!.error.message } }),
    rowTracked: (queueKey, item) => side.tracked.push(`${queueKey}/${item.key}`),
    rowRemoved: (queueKey, item) => side.removed.push(`${queueKey}/${item.key}`),
  })
  const core = scope.run(() => createUploadQueueCore(preset))!

  return {
    core,
    add: (queueKey, type = UploadQueueItemType.File) => {
      core.addRow(queueKey, fileRow(core.uniqueKey('file'), type, 1))
      return core.getQueueItems(queueKey).at(-1)!
    },
    run: async (row) => {
      await vi.waitFor(() => expect(runs.get(toRaw(row))).toBeDefined())
      const run = runs.get(toRaw(row))!
      return {
        succeed: async () => {
          // As the answer to the finish request: a row still being sent waits for the server from then on.
          if (row.status === Uploading) row.status = Processing
          run.resolve()
          await settled()
        },
        fail: async (how, text = 'the upload failed') => {
          run.finishAttempted = how !== 'beforeFinish'
          failing = row
          run.reject(
            how === 'beforeFinish'
              ? new Error(text)
              : new axios.AxiosError(text, 'ERR_BAD_RESPONSE', undefined, undefined, {
                  status: how === 'finishRefused' ? 403 : 500,
                } as never)
          )
          await settled()
        },
        stopped: () => run.stops > 0,
        cancelled: () => row.latestChunkAbortController?.signal.aborted === true,
        report: (progress, speed, estimate) => run.onProgress!(progress, speed, estimate),
      }
    },
    ...side,
    refreshTold: profile.calls.refreshMayHelp,
    end: () => {},
  }
}

describe.each([
  { name: 'the set of the library', library: true, make: librarySide },
  { name: 'the set of admin-dam', library: false, make: adminDamSide },
])('the core of an upload queue under $name', ({ library, make }) => {
  let side: Side
  let core: UploadQueueCore

  beforeEach(() => {
    setActivePinia(createPinia())
    clock = manualScheduler()
    uploadSettlementRuntime.scheduler = clock
    server = fakeDamServer()
    scope = effectScope()
    side = make()
    core = side.core
  })
  afterEach(() => {
    side.end()
    scope.stop()
    uploadSettlementRuntime.scheduler = realScheduler
  })

  const statuses = (rows: UploadQueueItem[]) => rows.map((row) => row.status)
  /** How many times the settlement asked the server about the asset of the row. */
  const asked = (row: UploadQueueItem) => server.requests.filter((request) => request.ids.includes(row.assetId!)).length
  /** The time of the first tick of the poll. */
  const poll = () => clock.advance(5 * S)
  /** The server reports the file of the row processed, and the settlement has written it. */
  const settleByServer = async (row: UploadQueueItem) => {
    server.fileBecomes(row.assetId!, AssetFileProcessStatus.Processed, {}, { licence: row.licenceId })
    const done = core.settlement.notify({ kind: 'processed', assetId: row.assetId!, fileId: row.fileId })
    await clock.advance(250)
    await done
    expect(row.status).toBe(Uploaded)
  }
  /** The server reports the file of the row failed. */
  const failByServer = async (row: UploadQueueItem) => {
    await core.settlement.notify({
      kind: 'failed',
      assetId: row.assetId!,
      fileId: row.fileId,
      failReason: AssetFileFailReason.InvalidMimeType,
    })
    expect(row.status).toBe(Failed)
  }

  describe('its queues', () => {
    it('start two rows of a queue at once, each queue on its own, and the next row once one is sent', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      const others = [side.add(OTHER), side.add(OTHER)]

      expect(statuses(rows)).toEqual([Uploading, Uploading, Waiting])
      expect(statuses(others)).toEqual([Uploading, Uploading])
      expect([core.getQueueTotalCount(QUEUE), core.getQueueTotalCount(OTHER)]).toEqual([3, 2])

      await (await side.run(rows[0]!)).succeed()

      expect(statuses(rows)).toEqual([Processing, Uploading, Uploading])
      expect(statuses(others)).toEqual([Uploading, Uploading])
    })

    // One count for the page: the core of another store gives no key this one has given.
    it('give each row a key of its own, from the prefix it is asked with, also beside another core', () => {
      const prefixes = ['file', 'file', 'asset']
      const keys = prefixes.map((prefix) => core.uniqueKey(prefix))
      const another = scope.run(() =>
        createUploadQueueCore(
          libraryQueuePreset({ queues: ref(new Map()), settlement: coreProfile(libProfile(server).profile) })
        )
      )!
      keys.push(another.uniqueKey('file'), another.uniqueKey('file'), core.uniqueKey('file'))

      expect(new Set(keys).size).toBe(6)
      expect(keys.map((key, index) => key.startsWith(prefixes[index] ?? 'file'))).toEqual(Array(6).fill(true))
    })

    it('are not written into where they are not', () => {
      const row = fileRow('row', UploadQueueItemType.File, 1)

      core.addQueueItem('nowhere', row)
      core.recalculateQueueCounts('nowhere')

      expect(core.getQueue('nowhere')).toBeNull()
      expect(core.getQueueItems('nowhere')).toEqual([])
    })

    // The key of a queue's file input makes the input new: a cleared queue is one on from whatever it was.
    it('are made empty by clearing, also one that was not there, their file input one key on', () => {
      expect(core.getQueueFileInputKey('nowhere')).toBe(-1)
      core.clearQueue('nowhere')
      expect(core.getQueue('nowhere')?.items).toEqual([])
      expect(core.getQueueFileInputKey('nowhere')).toBe(0)

      side.add(QUEUE)
      const key = core.getQueueFileInputKey(QUEUE)
      core.clearQueue(QUEUE)
      expect(core.getQueueItems(QUEUE)).toEqual([])
      expect(core.getQueueFileInputKey(QUEUE)).toBe(key + 1)
    })
  })

  describe('a run', () => {
    if (library) {
      // The library has no import: every row is sent by its upload, to its own address.
      it('sends every row by the upload of the library', async () => {
        const rows = [side.add(QUEUE), side.add(QUEUE, UploadQueueItemType.ExternalProviderAsset)]

        await side.run(rows[0]!)
        await side.run(rows[1]!)

        expect(statuses(rows)).toEqual([Uploading, Uploading])
        expect(rows.every((row) => row.fileId !== null)).toBe(true)
      })
    } else {
      it('runs a row of an external provider by its import, every other row by its upload', async () => {
        const rows = [side.add(QUEUE), side.add(QUEUE, UploadQueueItemType.ExternalProviderAsset)]

        expect(side.runners).toEqual([`upload/${rows[0]!.key}`, `import/${rows[1]!.key}`])
      })

      it('writes what a run reports of its progress into its row', async () => {
        const row = side.add(QUEUE)

        ;(await side.run(row)).report(42, 1000, 7)

        expect(row.progress).toEqual({ progressPercent: 42, speed: 1000, remainingTime: 7 })
      })
    }

    it('has a row whose file is sent asked about while it waits for the server', async () => {
      const row = side.add(QUEUE)
      await (await side.run(row)).succeed()
      expect(row.status).toBe(Processing)

      await poll()

      expect(asked(row)).toBeGreaterThan(0)
      expect(side.tracked).toEqual(library ? [] : [`${QUEUE}/${row.key}`])
    })

    // The settlement tells the core of a row it has settled, and the core counts the queue anew.
    it('counts a row the server settles once its file is sent', async () => {
      const row = side.add(QUEUE)
      await (await side.run(row)).succeed()
      expect(core.getQueueProcessedCount(QUEUE)).toBe(0)

      await settleByServer(row)

      expect(core.getQueueProcessedCount(QUEUE)).toBe(1)
    })

    it('does not have a row asked about that the server settled while its file was being sent', async () => {
      const row = side.add(QUEUE)
      const run = await side.run(row)
      await settleByServer(row)
      const before = asked(row)

      await run.succeed()
      await poll()

      expect(row.status).toBe(Uploaded)
      expect(asked(row)).toBe(before)
      expect(side.tracked).toEqual([])
    })

    it('marks a row failed, takes its form away, counts it and starts the next row', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      const run = await side.run(rows[0]!)
      // Its metadata came while its file was being sent.
      rows[0]!.canEditMetadata = true

      await run.fail('beforeFinish')

      expect(rows[0]).toMatchObject({ status: Failed, canEditMetadata: false, error: { hasError: true } })
      expect(statuses(rows)).toEqual([Failed, Uploading, Uploading])
      expect(core.getQueueProcessedCount(QUEUE)).toBe(1)
    })

    if (library) {
      // The library has no text of its own for a failed run: the row keeps what the upload wrote, and no alert.
      it('writes no text into a failed row', async () => {
        const row = side.add(QUEUE)

        await (await side.run(row)).fail('afterFinish')

        expect(row.error).toMatchObject({ hasError: true, message: '' })
      })
    } else {
      // The store's text is read before the core writes anything, and the alert is shown once the row is marked.
      it('asks the store for the text before it marks the row, and alerts after', async () => {
        const row = side.add(QUEUE)

        await (await side.run(row)).fail('afterFinish', 'the licence refuses uploads')

        expect(side.asked).toEqual([
          { text: 'the licence refuses uploads', row: { status: Uploading, message: '', hasError: false } },
        ])
        expect(side.alerts).toEqual([
          { text: 'the licence refuses uploads', row: { status: Failed, message: 'the licence refuses uploads' } },
        ])
        expect(row.error).toMatchObject({ hasError: true, message: 'the licence refuses uploads' })
      })

      it('alerts once for every reason the rows of a queue fail with', async () => {
        const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]

        await (await side.run(rows[0]!)).fail('beforeFinish', 'the licence refuses uploads')
        await (await side.run(rows[1]!)).fail('beforeFinish', 'the licence refuses uploads')
        await (await side.run(rows[2]!)).fail('beforeFinish', 'the file is too large')

        expect(side.alerts.map((alert) => alert.text)).toEqual(['the licence refuses uploads', 'the file is too large'])
        expect(rows.map((row) => row.error.message)).toEqual([
          'the licence refuses uploads',
          'the licence refuses uploads',
          'the file is too large',
        ])
      })
    }

    // The server may complete the file of a run whose finish request went out, whatever became of the answer.
    it('has a row asked about whose run failed after its finish request went out; only the library offers a refresh', async () => {
      const row = side.add(QUEUE)

      await (await side.run(row)).fail('afterFinish')
      await poll()

      expect(row.status).toBe(Failed)
      expect(asked(row)).toBeGreaterThan(0)
      expect(core.refreshMayHelp(row)).toBe(library)
      expect(side.tracked).toEqual(library ? [] : [`${QUEUE}/${row.key}`])
    })

    it.each<[string, Failure]>([
      ['before its finish request went out', 'beforeFinish'],
      ['when the server refused its finish request', 'finishRefused'],
    ])('does not have a row asked about whose run failed %s', async (_when, how) => {
      const row = side.add(QUEUE)

      await (await side.run(row)).fail(how)
      await poll()

      expect(row.status).toBe(Failed)
      expect(asked(row)).toBe(0)
      expect(core.refreshMayHelp(row)).toBe(false)
      expect(side.tracked).toEqual([])
    })

    // The server has said its last word about that file (Z26): the run is stopped with its chunk, and whatever it
    // fails with afterwards is not written over the reason of the server, nor told, nor is the row asked about.
    it('stops the run of a row the server failed while its file was being sent, and leaves the row as the server left it', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      const run = await side.run(rows[0]!)
      expect([run.stopped(), run.cancelled()]).toEqual([false, false])
      await failByServer(rows[0]!)

      expect([run.stopped(), run.cancelled()]).toEqual([true, true])
      expect(statuses(rows)).toEqual([Failed, Uploading, Uploading])

      await run.fail('afterFinish', 'the upload failed')
      await poll()

      expect(statuses(rows)).toEqual([Failed, Uploading, Uploading])
      expect(core.getQueueProcessedCount(QUEUE)).toBe(1)
      expect(asked(rows[0]!)).toBe(0)
      expect(core.refreshMayHelp(rows[0]!)).toBe(false)
      expect(side.tracked).toEqual([])
      expect(rows[0]!.error).toEqual({
        hasError: true,
        message: '',
        assetFileFailReason: AssetFileFailReason.InvalidMimeType,
      })
      expect(side.asked).toEqual([])
      expect(side.alerts).toEqual([])
    })

    // A row the server fails after its file was sent has no run to stop.
    it('fails a row that waits for the server by the word of the server, with nothing to stop', async () => {
      const row = side.add(QUEUE)
      const run = await side.run(row)
      await run.succeed()
      expect(row.status).toBe(Processing)

      await failByServer(row)

      expect([run.stopped(), run.cancelled()]).toEqual([false, false])
      expect(core.getQueueProcessedCount(QUEUE)).toBe(1)
    })

    it('leaves a row as it is, stopped, when its run fails after the row was taken out', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE)]
      const run = await side.run(rows[0]!)
      core.removeByIndex(QUEUE, 0)

      await run.fail('afterFinish')

      expect(rows[0]).toMatchObject({ status: Stop, error: { hasError: false, message: '' } })
      expect(side.asked).toEqual([])
      expect(side.alerts).toEqual([])
    })

    it('leaves a row as it is, uploaded, when its run fails after the server settled it', async () => {
      const row = side.add(QUEUE)
      const run = await side.run(row)
      await settleByServer(row)
      const before = asked(row)

      await run.fail('afterFinish')
      await poll()

      expect(row).toMatchObject({ status: Uploaded, error: { hasError: false } })
      expect(asked(row)).toBe(before)
      expect(side.asked).toEqual([])
      expect(side.alerts).toEqual([])
    })
  })

  describe('a row taken out', () => {
    it('by its position: nothing where the queue or the row is not', () => {
      const row = side.add(QUEUE)

      core.removeByIndex('nowhere', 0)
      core.removeByIndex(QUEUE, 1)

      expect(core.getQueueItems(QUEUE)).toEqual([row])
      expect(row.status).toBe(Uploading)
      expect(side.removed).toEqual([])
    })

    it('by its position: a row being sent is stopped with its run and its chunk, and the next row starts at once', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      const run = await side.run(rows[0]!)

      core.removeByIndex(QUEUE, 0)

      expect(statuses(rows)).toEqual([Stop, Uploading, Uploading])
      expect([run.stopped(), run.cancelled()]).toEqual([true, true])
      expect(core.getQueueItems(QUEUE)).toEqual([rows[1], rows[2]])
      expect(core.getQueueTotalCount(QUEUE)).toBe(2)
      expect(side.removed).toEqual(library ? [] : [`${QUEUE}/${rows[0]!.key}`])
    })

    it('by its position: a waiting row is stopped', () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]

      core.removeByIndex(QUEUE, 2)

      expect(statuses(rows)).toEqual([Uploading, Uploading, Stop])
      expect(core.getQueueItems(QUEUE)).toEqual([rows[0], rows[1]])
    })

    // A failed row the server may still finish is asked about: taken out, the settlement lets it go, and says a
    // refresh can no longer help it.
    it('by its position: a failed row the server may still finish is let go by the settlement', async () => {
      const row = side.add(QUEUE)
      await (await side.run(row)).fail('afterFinish')
      expect(side.refreshTold).toEqual([`+${row.key}`])

      core.removeByIndex(QUEUE, 0)

      expect(row.status).toBe(Failed)
      expect(side.refreshTold).toEqual([`+${row.key}`, `-${row.key}`])
      expect(core.refreshMayHelp(row)).toBe(false)
    })

    it('by its position: a row waiting for the server is stopped and no longer asked about', async () => {
      const row = side.add(QUEUE)
      await (await side.run(row)).succeed()

      core.removeByIndex(QUEUE, 0)
      await poll()

      expect(row.status).toBe(Stop)
      expect(asked(row)).toBe(0)
    })

    it('by its position: a settled row whose run is over keeps its state', async () => {
      const row = side.add(QUEUE)
      await (await side.run(row)).succeed()
      await settleByServer(row)

      core.removeByIndex(QUEUE, 0)

      expect(row.status).toBe(Uploaded)
      expect(core.getQueueItems(QUEUE)).toEqual([])
    })

    // A row the server settled while its file was still being sent: its run is stopped all the same (Z17).
    it('by its position: a settled row whose run still sends is stopped with its run', async () => {
      const row = side.add(QUEUE)
      const run = await side.run(row)
      await settleByServer(row)

      core.removeByIndex(QUEUE, 0)

      expect(row.status).toBe(Stop)
      expect([run.stopped(), run.cancelled()]).toEqual([true, true])
    })

    it('by itself: nothing where the queue is not or is empty', () => {
      const row = fileRow('row', UploadQueueItemType.File, 1)
      core.clearQueue(QUEUE)

      core.stopItemUpload('nowhere', row)
      core.stopItemUpload(QUEUE, row)

      expect(row.status).toBe(Waiting)
      expect(core.getQueue('nowhere')).toBeNull()
    })

    // A row of another queue: nothing takes it out of the queue named, and the settlement lets it go all the same.
    it('by itself: a row that is not in the queue named is stopped and let go by the settlement', async () => {
      side.add(QUEUE)
      const row = side.add(OTHER)
      await (await side.run(row)).fail('afterFinish')
      expect(side.refreshTold).toEqual([`+${row.key}`])

      core.stopItemUpload(QUEUE, row)

      expect(row.status).toBe(Stop)
      expect(side.refreshTold).toEqual([`+${row.key}`, `-${row.key}`])
      expect(core.getQueueItems(OTHER)).toEqual([row])
    })

    // The row is found where it is now, not where the caller saw it, and it is gone before the call returns.
    it('by itself: stopped with its run and its chunk, and gone at once', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      core.removeByIndex(QUEUE, 0)
      const run = await side.run(rows[2]!)

      core.stopItemUpload(QUEUE, rows[2]!)

      expect(statuses(rows)).toEqual([Stop, Uploading, Stop])
      expect([run.stopped(), run.cancelled()]).toEqual([true, true])
      expect(core.getQueueItems(QUEUE)).toEqual([rows[1]])
    })

    it('with its whole queue: nothing for a queue that is not, an empty queue as it is', () => {
      core.stopUpload('nowhere')
      expect(core.getQueue('nowhere')).toBeNull()

      core.clearQueue(QUEUE)
      const key = core.getQueueFileInputKey(QUEUE)
      core.stopUpload(QUEUE)

      expect(core.getQueueItems(QUEUE)).toEqual([])
      expect(core.getQueueFileInputKey(QUEUE)).toBe(key)
    })

    it('with its whole queue: every row stopped, every run, the chunks on their way cancelled, the queue emptied', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      const runs = [await side.run(rows[0]!), await side.run(rows[1]!)]
      const key = core.getQueueFileInputKey(QUEUE)

      core.stopUpload(QUEUE)

      expect(statuses(rows)).toEqual([Stop, Stop, Stop])
      expect(runs.map((run) => [run.stopped(), run.cancelled()])).toEqual([
        [true, true],
        [true, true],
      ])
      expect(core.getQueueItems(QUEUE)).toEqual([])
      // Cleared, and the file input made new.
      expect(core.getQueueFileInputKey(QUEUE)).toBe(key + 2)
      expect(side.removed).toEqual(library ? [] : rows.map((row) => `${QUEUE}/${row.key}`))
    })

    it('by clearing the queue: what is on its way or still runs is stopped, a settled row kept as it is', async () => {
      const rows = [side.add(QUEUE), side.add(QUEUE), side.add(QUEUE)]
      await (await side.run(rows[1]!)).succeed()
      await settleByServer(rows[1]!)
      // The third row starts in the place the second left, and the server settles it while its file is still sent.
      const stillSending = await side.run(rows[2]!)
      await settleByServer(rows[2]!)
      const run = await side.run(rows[0]!)
      const key = core.getQueueFileInputKey(QUEUE)

      core.clearQueue(QUEUE)

      expect(statuses(rows)).toEqual([Stop, Uploaded, Stop])
      expect([run.stopped(), run.cancelled()]).toEqual([true, true])
      expect([stillSending.stopped(), stillSending.cancelled()]).toEqual([true, true])
      expect(core.getQueueItems(QUEUE)).toEqual([])
      expect(core.getQueueFileInputKey(QUEUE)).toBe(key + 1)
      expect(side.removed).toEqual(library ? [] : rows.map((row) => `${QUEUE}/${row.key}`))
    })
  })
})

// The set of a store makes the run of a row, and may not be able to: the library's reads the DAM configuration of
// the queue, which the application may not have. Thrown past the core, that left the row waiting, started again
// and throwing again with every row after it.
describe('a row whose run cannot be made', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clock = manualScheduler()
    uploadSettlementRuntime.scheduler = clock
    server = fakeDamServer()
    scope = effectScope()
  })
  afterEach(() => {
    scope.stop()
    uploadSettlementRuntime.scheduler = realScheduler
  })

  it('fails as a failed upload does under the set of the library, and so does every row after it', async () => {
    const dam = createFakeDam(cmsConfiguration.endPoints)
    installConsumerProfile(cmsConfiguration, dam.client)
    const queues = ref(new Map<UploadQueueKey, UploadQueue>())
    const core = scope.run(() =>
      createUploadQueueCore(
        libraryQueuePreset({
          queues,
          settlement: coreProfile(libProfile(server).profile),
          configOf: () => 'a configuration the application has not got',
        })
      )
    )!

    for (let row = 0; row < 3; row++) {
      core.addRow(QUEUE, fileRow(core.uniqueKey('file'), UploadQueueItemType.File, cmsConfiguration.licence))
    }
    await settled()

    const rows = core.getQueueItems(QUEUE)
    expect(rows.map((row) => [row.status, row.error.hasError, row.error.message, row.canEditMetadata])).toEqual([
      [Failed, true, '', false],
      [Failed, true, '', false],
      [Failed, true, '', false],
    ])
    expect([core.getQueueTotalCount(QUEUE), core.getQueueProcessedCount(QUEUE)]).toEqual([3, 3])
    expect(dam.requests).toEqual([])
    expect(core.settlement.hasTracked()).toBe(false)
  })

  it("fails with the store's text and its alert under the set of admin-dam, and the next row starts", async () => {
    const alerts: string[] = []
    const started: string[] = []
    const core = scope.run(() =>
      createUploadQueueCore(
        adminDamQueuePreset({
          queues: ref<Record<UploadQueueKey, UploadQueue>>({}),
          settlement: coreProfile(damProfile(server).profile),
          upload: (item) => {
            started.push(item.key)
            throw new Error('no run for ' + item.key)
          },
          importRun: () => adminDamImportRun(() => Promise.resolve()),
          failureMessage: (error) => (error as Error).message,
          alert: (text) => alerts.push(text),
          rowTracked: () => {},
          rowRemoved: () => {},
        })
      )
    )!

    for (let row = 0; row < 3; row++) core.addRow(QUEUE, fileRow(core.uniqueKey('file'), UploadQueueItemType.File, 1))
    await settled()

    const rows = core.getQueueItems(QUEUE)
    expect(started).toEqual(rows.map((row) => row.key))
    expect(rows.map((row) => [row.status, row.error.hasError, row.error.message])).toEqual(
      rows.map((row) => [Failed, true, 'no run for ' + row.key])
    )
    expect(alerts).toEqual(rows.map((row) => 'no run for ' + row.key))
    expect([core.getQueueTotalCount(QUEUE), core.getQueueProcessedCount(QUEUE)]).toEqual([3, 3])
  })
})
