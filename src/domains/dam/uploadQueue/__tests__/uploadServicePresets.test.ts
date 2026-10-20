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

// One run of the upload service for both sides, under the set each side hands it: the library's own, which
// `useUpload` makes when it is given none, and admin-dam's, which `adminDamUploadPreset` makes from what the
// application hands in. Those inputs stand in for admin-dam's after step K3: the library's three requests at the
// address of the type of the row under the application's client, and its own texts, timeout and hash. The client is
// a fake DAM that records what it is sent; the pauses and the second of the speed meter are taken out of real time.
// Sentry is replaced by its module, so that what the requests report to it is recorded.

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
/** admin-dam's texts, each its own here, so that a row shows whose text it got. */
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
  // No options of the plugin: whatever reads them throws. The library's side installs them; admin-dam's does without.
  coreDamOptions.value = undefined
  waits = holdLongWaits(10_000, { passFrom: 1_000 })
})
afterEach(() => {
  waits.restore()
})

/**
 * admin-dam's requests after step K3 (`fileApi.ts`): the library's, at the address of the type of the row. Its
 * finish there also calls `startProcessing`, which the service does not read; it is left out here.
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
/** admin-dam's hash, a static import of the application there. It keeps what it is fed. */
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
/** Every chunk request is answered by what the test says, from the first attempt on; `undefined` is the DAM's own. */
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
    // A read of the options would throw.
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

  // The types are checked by `lint:tsc`: a run is of the side of its set; without one, an explicit `undefined` too,
  // it is the library's; and there is no run of admin-dam's side without the set of admin-dam.
  it('makes a run of its own side, and there is none of that side without it', () => {
    const item = row()
    const run = useUpload(item, undefined, adminDamSet())

    expectTypeOf(run[uploadSide]).toEqualTypeOf<'adminDam'>()
    expectTypeOf(run).toExtend<UploadRun<'adminDam'>>()
    expect(run[uploadSide]).toBe('adminDam')

    // Never called, so that only the types speak: without a set the run is the library's, whose set reads the
    // options of the plugin, and those are not set here. A call would throw for that whatever the types allowed.
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

  // Z27: admin-dam's own requests named no type, and the browser sent its chunks as "application/octet-stream".
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
    // The size the chunks of an upload reached outlives it (`damUploadChunkSize.ts`). Clamped to bounds of 0 it is
    // 0, and the next upload starts from the configuration again.
    const forgetChunkSize = () => {
      chunkSizeIs(0)
      useDamUploadChunkSize().updateChunkSize(1)
    }
    beforeEach(forgetChunkSize)
    afterEach(forgetChunkSize)

    // At 200 bytes a second a chunk of 1000 takes 5 s: too short for 30 s, which aims at 7.5 s (1500 bytes), and for
    // 120 s, which aims at 30 s (all 3000 at once). Without a timeout the chunks are sized against 30 s; for `null`
    // that is the library's rule (Z32): admin-dam's own service took `null` for 0 s, and every chunk for the smallest.
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

// B5: whether a file of no bytes is sent is what goes to the backend, and stays with each side.
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

// Z12: one function, with the texts of the side it is handed.
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
    // Shaped as an answer with fields, only not an error of axios: it is not read as one.
    ['what is no error of axios', { response: { data: { error: 'validation_failed', fields: { size: ['x'] } } } }],
    ['an error of axios with no answer', new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK)],
    ['an answer with no fields', answered(422, { error: 'validation_failed' })],
  ])('is the unknown error of the side for %s', (_what, error) => {
    expect(uploadValidationMessage(error, APP_TEXTS)).toBe(APP_TEXTS.unknownError())
  })
})

// Z2: admin-dam sends its chunks with the library's request after step K3, and the request checks a chunk before
// it sends it. The run below never hands it a size or an offset of this kind; only the request does the checking.
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
  /** What the side has set up by the time a file is sent. */
  install: () => void
  run: (item: UploadQueueItem, report?: UploadProgressCallback) => Run
  /** The text a chunk answered "bad request" four times leaves in its row. */
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
    it('a chunk of no bytes is not sent, and is reported as invalid', async () => {
      // As the store is before the DAM configuration is loaded.
      chunkSizeIs(0)
      // A chunk that did get to the DAM would be refused, so that the upload ends either way.
      chunkAnswers(() => ({ status: 500 }))
      const { run } = await started()

      expect(await outcome(run.upload())).toBe('rejected')

      expect(chunksSent()).toBe(0)
      expect(finishesSent()).toBe(0)
      expect(sentry.logMessage).toHaveBeenCalledWith(
        'dam_upload_chunk_validation',
        'error',
        expect.objectContaining({ extra: expect.objectContaining({ offset: 0, size: 0 }) })
      )
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
      // The second of the meter and the pauses before a retry are held, and let pass by the test.
      waits.restore()
      waits = holdLongWaits(SECOND)
    })

    /** What axios tells of a chunk on its way: half of it, and a moment later all of it. */
    const onItsWay = async (request: FakeDamRequest) => {
      const progress = request.config.onUploadProgress!
      const { size } = (request.data as FormData).get('file') as File
      progress({ loaded: Math.floor(size / 2), total: size } as never)
      await waits.settle(20)
      progress({ loaded: size, total: size } as never)
    }
    /**
     * The held waits pass, round by round, until the upload is over. Only once the run is started: one of them is the
     * time the library gives rusha to load.
     */
    const toTheEnd = async (uploading: Promise<string>) => {
      let ended: string | undefined
      void uploading.then((result) => (ended = result))
      for (let round = 0; round < 50 && ended === undefined; round++) await waits.elapse()
      return ended
    }

    /** What comes before upload() in a case. */
    type BeforeUpload = (item: UploadQueueItem, run: Run) => Promise<void>
    const failed = async (beforeUpload: BeforeUpload) => {
      const item = row()
      const run = side.run(item, report)
      await beforeUpload(item, run)

      expect(await toTheEnd(outcome(run.upload()))).toBe('rejected')
    }

    // No chunk of these is answered, and a try that failed leaves the meter nothing to tell of
    // (`uploadMeter.test.ts`): its second is all there is to see.
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
        async (_item, run) => {
          chunkSizeIs(0)
          chunkAnswers(() => ({ status: 500 }))
          await run.uploadInit()
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
      // stop() cancels the chunk on its way: the answer the DAM would give never reaches the meter.
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

    // Its chunk was answered, so the meter has a speed: a second left running would report the whole file.
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

  // Z5: a run is stopped by the status of its row (as the queue stops it) or by its own stop(), and every point
  // where it looks reads both. stop() also cancels the chunk on its way; a stop that lands while a chunk is
  // answered therefore ends that chunk under stop(), and the one after it under the status of the row.
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
      // The pause before a retry is held, and let pass by the test.
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
      // Up to the read of the first chunk nothing is waited for.
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

      // No pause before another try is asked for.
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
