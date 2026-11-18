import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import axios, { type AxiosInstance } from 'axios'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import {
  createFakeDam,
  type FakeDam,
  type FakeDamAnswer,
  type FakeDamRequest,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  imageUploadChunk as damFileUploadChunk,
  imageUploadFinish as damFileUploadFinish,
  imageUploadStart as damFileUploadStart,
} from '@/domains/dam/api/damImageApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  type DamUploadStartResponse,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
} from '@/domains/dam/types/UploadQueue'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { uploadValidationMessage, useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import {
  adminDamUploadPreset,
  type UploadHash,
  type UploadMessages,
  type UploadProgressCallback,
  type UploadRun,
  type UploadRunRequests,
  uploadSide,
} from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { NEW_LINE_MARK } from '@/domains/system/composables/alerts'
import { commonT } from '@/plugins/i18n'
import { coreDamOptions } from '@/plugins/pluginOptions'

// Runs the upload service for both sides, each with its own preset: the library's (made
// by `useUpload` when none is given) and admin-dam's (made by `adminDamUploadPreset`).
// The inputs stand in for admin-dam's after step K3. The client is a fake DAM that records requests.
// Sentry is mocked to record what the requests report.

const sentry = vi.hoisted(() => ({ logError: vi.fn(), logMessage: vi.fn() }))
vi.mock('@/domains/system/composables/sentry', () => ({ useSentry: () => sentry }))

const CHUNK = 1024
const SECOND = 1_000
const LICENCE = ugcConfiguration.licence
const BYTES = Uint8Array.from({ length: 3000 }, (_, index) => index % 251)

const ADMIN_DAM_ASSET = '/adm/v1/asset'
const ADMIN_DAM_END_POINTS: Record<DamAssetTypeType, string> = {
  [DamAssetType.Image]: '/adm/v1/image',
  [DamAssetType.Audio]: '/adm/v1/audio',
  [DamAssetType.Video]: '/adm/v1/video',
  [DamAssetType.Document]: '/adm/v1/document',
}
const APP_TEXTS: UploadMessages = {
  unknownError: () => 'admin-dam: unknown error',
  size: () => 'admin-dam: size',
  offset: () => 'admin-dam: offset',
  mimeType: () => 'admin-dam: mime type',
  systemError: () => 'admin-dam: system error',
  chunkValidationFailed: () => 'admin-dam: chunk refused',
}
const APP_DIGEST = 'sha-of-admin-dam'

let dam: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  // No plugin options are set, so anything that reads them throws.
  // The library's side installs them; admin-dam's does without.
  coreDamOptions.value = undefined
  waits = holdLongWaits(10_000, { passFrom: 1_000 })
})
afterEach(() => {
  waits.restore()
})

/**
 * admin-dam's requests after step K3 (`fileApi.ts`): the library's, at the address of the row type.
 * Its finish also calls `startProcessing`, which the service does not read, so it is left out.
 */
const adminDamRequests = (client: () => AxiosInstance): UploadRunRequests => ({
  start: (item) =>
    damFileUploadStart(client, ADMIN_DAM_END_POINTS[item.assetType], item) as Promise<DamUploadStartResponse>,
  chunk: (item, fileId, chunk, size, offset, onUploadProgress) =>
    damFileUploadChunk(
      client,
      ADMIN_DAM_END_POINTS[item.assetType],
      item,
      fileId,
      chunk,
      size,
      offset,
      onUploadProgress
    ),
  finish: (item, sha) => damFileUploadFinish(client, ADMIN_DAM_END_POINTS[item.assetType], item, sha),
})
const appHash = (fed: ArrayBuffer[] = []): UploadHash => ({
  update: (data) => fed.push(data),
  digest: () => APP_DIGEST,
})
const adminDamSet = (inputs: { apiTimeout?: number | null; loadHash?: () => Promise<UploadHash> } = {}) =>
  adminDamUploadPreset({
    requests: adminDamRequests(dam.client),
    messages: APP_TEXTS,
    apiTimeout: 'apiTimeout' in inputs ? inputs.apiTimeout : 30,
    loadHash: inputs.loadHash ?? (() => Promise.resolve(appHash())),
  })

const chunkSizeIs = (size: number) => {
  useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: size, maxSize: size }
}
const row = (
  file = new File([BYTES], 'photo.jpg', { type: 'image/jpeg' }),
  assetType: DamAssetTypeType = DamAssetType.Image
) => {
  const item = useUploadQueueItemFactory().createDefault(
    `file_${file.name}`,
    UploadQueueItemType.File,
    UploadQueueItemStatus.Waiting,
    assetType,
    CHUNK,
    LICENCE
  )
  item.file = file
  return item
}
const sent = () => dam.requests.map((request) => `${request.method} ${request.url}`)
const startsSent = () => dam.sentTo('POST', dam.routes.start).length
const chunksSent = () => dam.sentTo('POST', dam.routes.chunk).length
const finishesSent = () => dam.sentTo('PATCH', dam.routes.finish).length
const chunkParts = () =>
  dam.sentTo('POST', dam.routes.chunk).map((request) => (request.data as FormData).get('file') as File)
const chunkAnswers = (
  answer: (attempt: number, request: FakeDamRequest) => FakeDamAnswer | Promise<FakeDamAnswer> | undefined
) => {
  let attempt = 0
  dam.reply((request) =>
    request.method === 'POST' && dam.routes.chunk.test(request.url) ? answer(++attempt, request) : undefined
  )
}
const noConnection = (): never => {
  throw new Error('Network Error')
}
const invalid = (fields: Record<string, string[]>): FakeDamAnswer => ({
  status: 422,
  data: { contextId: 'context', error: 'validation_failed', fields },
})
const outcome = (upload: Promise<unknown>) =>
  upload.then(
    () => 'resolved',
    () => 'rejected'
  )

describe('the set of admin-dam', () => {
  beforeEach(() => {
    dam = createFakeDam({ asset: ADMIN_DAM_ASSET, image: ADMIN_DAM_END_POINTS[DamAssetType.Image] })
    chunkSizeIs(CHUNK)
  })

  it('uploads a file of any type to the addresses of the application, and reads no option of the plugin', async () => {
    expect(() => useCommonAdminCoreDamOptions('default')).toThrow()
    dam = createFakeDam({ asset: ADMIN_DAM_ASSET, image: ADMIN_DAM_END_POINTS[DamAssetType.Video] })
    const item = row(new File([BYTES], 'clip.mp4', { type: 'video/mp4' }), DamAssetType.Video)
    const run = useUpload(item, undefined, adminDamSet())

    await run.uploadInit()
    await run.upload()

    expect(sent()).toEqual([
      `POST /adm/v1/video/licence/${LICENCE}`,
      `POST /adm/v1/video/${item.fileId}/chunk`,
      `POST /adm/v1/video/${item.fileId}/chunk`,
      `POST /adm/v1/video/${item.fileId}/chunk`,
      `PATCH /adm/v1/video/${item.fileId}/uploaded`,
    ])
    expect(run.finishAttempted()).toBe(true)
    expect(dam.unanswered).toEqual([])
  })

  // Types are checked by `lint:tsc`: a run has the side of its set;
  // without a set, even with an explicit `undefined`, it is the library's.
  // There is no admin-dam run without the admin-dam set.
  it('makes a run of its own side, and there is none of that side without it', () => {
    const item = row()
    const run = useUpload(item, undefined, adminDamSet())

    expectTypeOf(run[uploadSide]).toEqualTypeOf<'adminDam'>()
    expectTypeOf(run).toExtend<UploadRun<'adminDam'>>()
    expect(run[uploadSide]).toBe('adminDam')

    // Never called, so only the types are tested. Without a set the run is the library's,
    // whose set reads the plugin options, and those are not set here. A call would throw.
    const libraryRun = () => useUpload(item, undefined, undefined)
    expectTypeOf<ReturnType<typeof libraryRun>[typeof uploadSide]>().toEqualTypeOf<'library'>()
    // @ts-expect-error -- a run of admin-dam needs the set of admin-dam
    const adminDamRunWithoutSet = () => useUpload<'adminDam'>(item)
    expectTypeOf(adminDamRunWithoutSet).toBeFunction()
  })

  it('hashes the file with the hash of the application, fed every byte in order, and finishes with its digest', async () => {
    const fed: ArrayBuffer[] = []
    const loadHash = vi.fn(() => Promise.resolve(appHash(fed)))
    const run = useUpload(row(), undefined, adminDamSet({ loadHash }))

    await run.uploadInit()
    await run.upload()

    expect(loadHash).toHaveBeenCalledTimes(1)
    expect(new Uint8Array(await new Blob(fed).arrayBuffer())).toEqual(BYTES)
    expect(dam.body(dam.sentTo('PATCH', dam.routes.finish)[0])).toEqual({ checksum: APP_DIGEST })
  })

  // Z27: admin-dam's own requests named no type, so the browser sent chunks as "application/octet-stream".
  it('sends each chunk as a file of the name and type of the one picked, as the library does', async () => {
    const run = useUpload(row(), undefined, adminDamSet())

    await run.uploadInit()
    await run.upload()

    expect(chunkParts().map((part) => [part.name, part.type, part.size])).toEqual([
      ['photo.jpg', 'image/jpeg', 1024],
      ['photo.jpg', 'image/jpeg', 1024],
      ['photo.jpg', 'image/jpeg', 952],
    ])
  })

  it('names each field a chunk is refused for, a line each, in the texts of the application', async () => {
    chunkAnswers(() =>
      invalid({
        size: ['error_field_invalid'],
        offset: ['error_field_invalid'],
        mimeType: ['error_field_invalid'],
        checksum: ['error_one', 'error_two'],
      })
    )
    const item = row()
    const run = useUpload(item, undefined, adminDamSet())
    await run.uploadInit()

    expect(await outcome(run.upload())).toBe('rejected')

    expect(chunksSent()).toBe(1)
    expect(item.error.message).toBe(
      [
        APP_TEXTS.size(),
        APP_TEXTS.offset(),
        APP_TEXTS.mimeType(),
        APP_TEXTS.systemError() + ': checksum - error_one,error_two',
      ].join(NEW_LINE_MARK)
    )
  })

  describe('and the timeout of the application', () => {
    // The chunk size an upload reached outlives it (`damUploadChunkSize.ts`).
    // Clamped to bounds of 0 it is 0, and the next upload starts from the configuration again.
    const forgetChunkSize = () => {
      chunkSizeIs(0)
      useDamUploadChunkSize().updateChunkSize(1)
    }
    beforeEach(forgetChunkSize)
    afterEach(forgetChunkSize)

    // At 200 bytes a second a chunk of 1000 takes 5 s: too short for 30 s (aims at 7.5 s) and for 120 s (aims at 30 s).
    // Without a timeout, chunks are sized against 30 s. For `null` this is the library's rule
    // (Z32): admin-dam's own service took `null` as 0 s and sized every chunk to the smallest.
    it.each<[number | null | undefined, number[]]>([
      [30, [1500, 1500]],
      [120, [3000]],
      [null, [1500, 1500]],
      [undefined, [1500, 1500]],
    ])('sizes the chunks against the timeout it hands in (%s)', async (apiTimeout, sizes) => {
      useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 1000, maxSize: 100_000 }
      const item = row()
      item.progress.speed = 200
      const run = useUpload(item, undefined, adminDamSet({ apiTimeout }))

      await run.uploadInit()
      await run.upload()

      expect(chunkParts().map((part) => part.size)).toEqual(sizes)
    })
  })
})

// B5: whether a file of no bytes is sent goes to the backend, and stays with each side.
describe('a file of no bytes', () => {
  const empty = () => row(new File([], 'empty.jpg', { type: 'image/jpeg' }))

  it('is started and finished under the set of admin-dam, with no chunk between', async () => {
    dam = createFakeDam({ asset: ADMIN_DAM_ASSET, image: ADMIN_DAM_END_POINTS[DamAssetType.Image] })
    chunkSizeIs(CHUNK)
    const item = empty()
    const run = useUpload(item, undefined, adminDamSet())

    await run.uploadInit()
    await run.upload()

    expect(sent()).toEqual([`POST /adm/v1/image/licence/${LICENCE}`, `PATCH /adm/v1/image/${item.fileId}/uploaded`])
    expect(dam.body(dam.requests[0])).toEqual({ mimeType: 'image/jpeg', size: 0 })
    expect(dam.body(dam.requests[1])).toEqual({ checksum: APP_DIGEST })
  })

  it('is refused under the set of the library before anything is asked', async () => {
    dam = createFakeDam(ugcConfiguration.endPoints)
    installConsumerProfile(ugcConfiguration, dam.client)
    const run = useUpload(empty())

    await expect(run.uploadInit()).rejects.toThrow('Empty file')

    expect(dam.requests).toEqual([])
  })
})

describe('the text of a validation answer', () => {
  const answered = (status: number, data: unknown) =>
    new axios.AxiosError('Request failed', axios.AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
      status,
      statusText: '',
      data,
      headers: {},
      config: {},
    } as never)

  it('is a line for each field refused, in the texts it is handed', () => {
    const error = answered(422, { error: 'validation_failed', fields: { mimeType: ['x'], other: ['a', 'b'] } })

    expect(uploadValidationMessage(error, APP_TEXTS)).toBe(
      [APP_TEXTS.mimeType(), APP_TEXTS.systemError() + ': other - a,b'].join(NEW_LINE_MARK)
    )
  })

  it.each([
    // Shaped like an answer with fields but not an axios error, so it must not be read as one.
    ['what is no error of axios', { response: { data: { error: 'validation_failed', fields: { size: ['x'] } } } }],
    ['an error of axios with no answer', new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK)],
    ['an answer with no fields', answered(422, { error: 'validation_failed' })],
  ])('is the unknown error of the side for %s', (_what, error) => {
    expect(uploadValidationMessage(error, APP_TEXTS)).toBe(APP_TEXTS.unknownError())
  })
})

// Z2: admin-dam sends chunks with the library's request after
// step K3, and the request validates a chunk before sending.
// The run never hands it such a size or offset, so only the request does the check.
describe('the chunk request both sets send with', () => {
  beforeEach(() => {
    dam = createFakeDam({ asset: ADMIN_DAM_ASSET, image: ADMIN_DAM_END_POINTS[DamAssetType.Image] })
  })

  it.each<[string, number, number, string]>([
    ['a size of 0', 0, 0, 'dam_upload_chunk_validation_size'],
    ['a size below 0', -3, 0, 'dam_upload_chunk_validation_size'],
    ['a size that is no whole number', 1.5, 0, 'dam_upload_chunk_validation_size'],
    ['an offset below 0', 3, -1, 'dam_upload_chunk_validation_offset'],
    ['an offset that is no whole number', 3, 0.5, 'dam_upload_chunk_validation_offset'],
  ])('does not send a chunk with %s, and reports it as invalid', async (_what, size, offset, errorType) => {
    const chunk = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' })

    await expect(
      damFileUploadChunk(dam.client, ADMIN_DAM_END_POINTS[DamAssetType.Image], row(), 'file-1', chunk, size, offset)
    ).rejects.toThrow()

    expect(dam.requests).toEqual([])
    expect(sentry.logMessage).toHaveBeenCalledWith(
      'dam_upload_chunk_validation',
      'error',
      expect.objectContaining({ tags: { error_type: errorType } })
    )
  })
})

type Run = Pick<UploadRun, 'uploadInit' | 'upload' | 'stop' | 'finishAttempted'>

interface Side {
  name: string
  endPoints: { asset: string; image: string }
  install: () => void
  run: (item: UploadQueueItem, report?: UploadProgressCallback) => Run
  chunkRefused: () => string
}

const sides: Side[] = [
  {
    name: 'the set of the library',
    endPoints: ugcConfiguration.endPoints,
    install: () => {
      installConsumerProfile(ugcConfiguration, dam.client)
    },
    run: (item, report) => useUpload(item, report),
    chunkRefused: () => commonT('common.damImage.uploadErrors.chunkValidationFailed'),
  },
  {
    name: 'the set of admin-dam',
    endPoints: { asset: ADMIN_DAM_ASSET, image: ADMIN_DAM_END_POINTS[DamAssetType.Image] },
    install: () => undefined,
    run: (item, report) => useUpload(item, report, adminDamSet()),
    chunkRefused: APP_TEXTS.chunkValidationFailed,
  },
]

describe.each(sides)('under $name', (side) => {
  beforeEach(() => {
    dam = createFakeDam(side.endPoints)
    side.install()
    chunkSizeIs(CHUNK)
  })

  const started = async () => {
    const item = row()
    const run = side.run(item)
    await run.uploadInit()
    return { item, run }
  }

  describe('what a chunk request reports to Sentry (Z2)', () => {
    // Its request used to refuse a chunk of no bytes before sending and report it as
    // invalid, after the asset was created. The upload is now refused before that.
    it('a chunk of no bytes is not sent, nor tried: nothing is reported', async () => {
      chunkSizeIs(0)

      await expect(side.run(row()).uploadInit()).rejects.toThrow('are not loaded')

      expect([startsSent(), chunksSent(), finishesSent()]).toEqual([0, 0, 0])
      expect(sentry.logMessage).not.toHaveBeenCalled()
      expect(sentry.logError).not.toHaveBeenCalled()
    })

    it('each answer "bad request" to a chunk is reported, and the row then says so in the texts of the side', async () => {
      chunkAnswers(() => ({ status: 400, data: { error: 'bad_request' } }))
      const { item, run } = await started()

      expect(await outcome(run.upload())).toBe('rejected')

      expect(chunksSent()).toBe(4)
      expect(sentry.logError).toHaveBeenCalledTimes(4)
      for (const [error, context] of sentry.logError.mock.calls) {
        expect(axios.isAxiosError(error) && error.response?.status).toBe(400)
        expect(context).toMatchObject({ tags: { error_type: 'dam_upload_chunk_400' } })
      }
      expect(item.error.message).toBe(side.chunkRefused())
    })
  })

  // Z10: the service stops its meter itself, whatever the upload failed of and whoever called it.
  describe('a failed upload that reports its progress', () => {
    let reports: number[]
    const report: UploadProgressCallback = (percent) => reports.push(percent)

    beforeEach(() => {
      reports = []
      waits.restore()
      waits = holdLongWaits(SECOND)
    })

    const onItsWay = async (request: FakeDamRequest) => {
      const progress = request.config.onUploadProgress!
      const { size } = (request.data as FormData).get('file') as File
      progress({ loaded: Math.floor(size / 2), total: size } as never)
      await waits.settle(20)
      progress({ loaded: size, total: size } as never)
    }
    /**
     * The held waits pass round by round until the upload is over. Only once the run
     * is started, because one of them is the time the library gives rusha to load.
     */
    const toTheEnd = async (uploading: Promise<string>) => {
      let ended: string | undefined
      void uploading.then((result) => (ended = result))
      for (let round = 0; round < 50 && ended === undefined; round++) await waits.elapse()
      return ended
    }

    type BeforeUpload = (item: UploadQueueItem, run: Run) => Promise<void>
    const failed = async (beforeUpload: BeforeUpload) => {
      const item = row()
      const run = side.run(item, report)
      await beforeUpload(item, run)

      expect(await toTheEnd(outcome(run.upload()))).toBe('rejected')
    }

    // No chunk is answered here, and a failed try leaves the meter nothing
    // to report (`uploadMeter.test.ts`). Only its second is visible.
    it.each<[string, BeforeUpload]>([
      ['upload() is called without uploadInit()', async () => undefined],
      [
        'its row has no file',
        async (item, run) => {
          item.file = null
          await expect(run.uploadInit()).rejects.toThrow()
        },
      ],
      [
        'no chunk gets through',
        async (_item, run) => {
          chunkAnswers(async (_attempt, request) => {
            await onItsWay(request)
            return noConnection()
          })
          await run.uploadInit()
        },
      ],
      [
        'a chunk is refused as invalid',
        async (_item, run) => {
          chunkAnswers(async (_attempt, request) => {
            await onItsWay(request)
            return invalid({ size: ['error_field_invalid'] })
          })
          await run.uploadInit()
        },
      ],
      [
        'a chunk is answered "bad request" four times',
        async (_item, run) => {
          chunkAnswers(async (_attempt, request) => {
            await onItsWay(request)
            return { status: 400, data: { error: 'bad_request' } }
          })
          await run.uploadInit()
        },
      ],
      [
        'its chunks have no bytes',
        async (item, run) => {
          chunkAnswers(() => ({ status: 500 }))
          await run.uploadInit()
          // Emptied once the upload started: an upload does not start without
          // bounds, so at any speed the chunk size is taken back into them, to 0.
          chunkSizeIs(0)
          item.progress.speed = 1
        },
      ],
      [
        'its row is stopped while a chunk is on its way',
        async (item, run) => {
          chunkAnswers(async (_attempt, request) => {
            await onItsWay(request)
            item.status = UploadQueueItemStatus.Stop
            return { status: 503 }
          })
          await run.uploadInit()
        },
      ],
      // stop() cancels the chunk on its way, so the DAM's answer never reaches the meter.
      [
        'it is stopped by stop() while a chunk is on its way',
        async (_item, run) => {
          chunkAnswers(async (_attempt, request) => {
            await onItsWay(request)
            run.stop()
            return { status: 201, data: {} }
          })
          await run.uploadInit()
        },
      ],
    ])('leaves no second of the meter waiting when %s', async (_how, beforeUpload) => {
      await failed(beforeUpload)

      expect(waits.lengths()).not.toContain(SECOND)
    })

    // The chunk was answered, so the meter has a speed. A second left running would report the whole file.
    it('leaves no second of the meter waiting, and reports no more, when its finish is refused', async () => {
      await failed(async (_item, run) => {
        chunkAnswers(async (_attempt, request) => {
          await onItsWay(request)
          return { status: 201, data: {} }
        })
        dam.reply((request) =>
          request.method === 'PATCH' && dam.routes.finish.test(request.url) ? { status: 500 } : undefined
        )
        await run.uploadInit()
      })

      expect(waits.lengths()).not.toContain(SECOND)
      const reported = reports.length
      await waits.elapseAll()
      expect(reports).toHaveLength(reported)
    })
  })

  // Z5: a run is stopped by the status of its row (as the queue
  // stops it) or by its own stop(). Every check point reads both.
  // stop() also cancels the chunk on its way. A stop during a chunk answer
  // ends that chunk under stop() and the next under the row status.
  describe.each<[string, (item: UploadQueueItem, run: Run) => void]>([
    [
      'by the status of its row',
      (item) => {
        item.status = UploadQueueItemStatus.Stop
      },
    ],
    ['by stop()', (_item, run) => run.stop()],
  ])('an upload stopped %s', (_way, stopWay) => {
    let item: UploadQueueItem
    let run: Run
    const stopIt = () => stopWay(item, run)

    beforeEach(() => {
      waits.restore()
      waits = holdLongWaits(SECOND)
      item = row()
      run = side.run(item)
    })

    it('while its hash is prepared: no start is asked for', async () => {
      const initializing = run.uploadInit()
      stopIt()

      await expect(initializing).rejects.toThrow('Upload stopped')

      expect(dam.requests).toEqual([])
    })

    it('while its start is on its way: it ends there', async () => {
      const starts = dam.hold('POST', dam.routes.start)
      const initializing = run.uploadInit()
      await vi.waitFor(() => expect(starts.waiting).toHaveLength(1))

      stopIt()
      starts.release()

      await expect(initializing).rejects.toThrow('Upload stopped')
      expect(sent()).toHaveLength(1)
      expect(startsSent()).toBe(1)
    })

    it('between its start and its first chunk: no chunk is sent', async () => {
      await run.uploadInit()
      stopIt()

      await expect(run.upload()).rejects.toThrow('Upload stopped')

      expect(chunksSent()).toBe(0)
      expect(finishesSent()).toBe(0)
    })

    it('while its first chunk is read: the chunk is not sent', async () => {
      await run.uploadInit()
      const uploading = run.upload()
      stopIt()

      await expect(uploading).rejects.toThrow('Upload stopped')

      expect(chunksSent()).toBe(0)
      expect(finishesSent()).toBe(0)
    })

    it('as its first chunk is answered: no further chunk is sent', async () => {
      chunkAnswers((attempt) => {
        if (attempt === 1) stopIt()
        return undefined
      })
      await run.uploadInit()

      expect(await outcome(run.upload())).toBe('rejected')

      expect(chunksSent()).toBe(1)
      expect(finishesSent()).toBe(0)
    })

    it('while a chunk is on its way: the chunk is not tried again', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await run.uploadInit()
      const uploading = outcome(run.upload())
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))

      stopIt()
      chunks.release({ status: 503 })
      await waits.settle()

      expect(waits.lengths()).toEqual([])
      expect(await uploading).toBe('rejected')
      expect(chunksSent()).toBe(1)
      expect(finishesSent()).toBe(0)
    })

    it('in the pause before a chunk is tried again: it is not tried again', async () => {
      chunkAnswers(noConnection)
      await run.uploadInit()
      const uploading = outcome(run.upload())
      await vi.waitFor(() => expect(waits.lengths()).toEqual([SECOND]))
      expect(chunksSent()).toBe(1)

      stopIt()
      await waits.elapse()

      expect(chunksSent()).toBe(1)
      expect(await uploading).toBe('rejected')
      expect(finishesSent()).toBe(0)
    })

    it('as its last chunk is answered: it is not finished', async () => {
      chunkAnswers((attempt) => {
        if (attempt === 3) stopIt()
        return undefined
      })
      await run.uploadInit()

      expect(await outcome(run.upload())).toBe('rejected')

      expect(chunksSent()).toBe(3)
      expect(finishesSent()).toBe(0)
      expect(run.finishAttempted()).toBe(false)
    })
  })
})
