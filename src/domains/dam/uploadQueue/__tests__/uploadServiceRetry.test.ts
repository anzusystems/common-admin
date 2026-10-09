import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamAnswer } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { uploadStop, useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { NEW_LINE_MARK } from '@/domains/system/composables/alerts'
import { commonT } from '@/plugins/i18n'

// A chunk that does not go through: how often it is tried again, what ends the tries, and what the row is told.
// The real upload service and the real requests against a client that records them. The pause before a chunk is
// tried again is taken out of real time; its length is recorded.

const { endPoints } = ugcConfiguration

let dam: FakeDam
let waits: LongWaits

beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam(endPoints)
  installConsumerProfile(ugcConfiguration, dam.client)
  waits = holdLongWaits(10_000, { passFrom: 1_000 })
})
afterEach(() => {
  waits.restore()
})

const row = () => {
  const item = useUploadQueueItemFactory().createDefault(
    'file_photo.jpg',
    UploadQueueItemType.File,
    UploadQueueItemStatus.Waiting,
    DamAssetType.Image,
    1024,
    ugcConfiguration.licence
  )
  item.file = new File(['12345'], 'photo.jpg', { type: 'image/jpeg' })
  return item
}
const chunksSent = () => dam.sentTo('POST', dam.routes.chunk).length
const finishesSent = () => dam.sentTo('PATCH', dam.routes.finish).length
/** Every chunk request is answered by what the test says, from the first attempt on. */
const chunkAnswers = (answer: (attempt: number) => FakeDamAnswer | undefined) => {
  let attempt = 0
  dam.reply((request) =>
    request.method === 'POST' && dam.routes.chunk.test(request.url) ? answer(++attempt) : undefined
  )
}
const noConnection = () => {
  throw new Error('Network Error')
}
const outcome = (upload: Promise<unknown>) =>
  upload.then(
    () => 'resolved',
    () => 'rejected'
  )
/** What the queue does to a row on Stop. */
const stop = (item: UploadQueueItem) => {
  item.status = UploadQueueItemStatus.Stop
  if (item.latestChunkAbortController) uploadStop(item.latestChunkAbortController)
}
const started = async () => {
  const item = row()
  const { uploadInit, upload } = useUpload(item)
  await uploadInit()
  return { item, upload }
}

describe('a chunk that does not go through', () => {
  it.each([
    ['there is no connection', noConnection],
    ['the server answers with an error', () => ({ status: 500 })],
  ])('is tried four times when %s, with a longer pause each time, and then given up', async (_why, answer) => {
    chunkAnswers(answer)
    const { item, upload } = await started()

    expect(await outcome(upload())).toBe('rejected')

    expect(chunksSent()).toBe(4)
    expect(waits.passed).toEqual([1000, 3000, 9000])
    expect(finishesSent()).toBe(0)
    // Nothing is said in the row: the queue marks it failed, and the row shows its general error.
    expect(item.error.message).toBe('')
  })

  it('goes through on a later try, and the upload goes on to its end', async () => {
    chunkAnswers((attempt) => (attempt < 3 ? { status: 503 } : undefined))
    const { item, upload } = await started()

    expect(await outcome(upload())).toBe('resolved')

    expect(chunksSent()).toBe(3)
    expect(waits.passed.slice(0, 2)).toEqual([1000, 3000])
    expect(finishesSent()).toBe(1)
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
  })

  it('is given up after the fourth try with a message of its own when the server keeps answering "bad request"', async () => {
    chunkAnswers(() => ({ status: 400, data: { error: 'bad_request' } }))
    const { item, upload } = await started()

    expect(await outcome(upload())).toBe('rejected')

    expect(chunksSent()).toBe(4)
    expect(item.error.message).toBe(commonT('common.damImage.uploadErrors.chunkValidationFailed'))
    expect(finishesSent()).toBe(0)
  })
})

describe('a chunk the server refuses as invalid', () => {
  const invalid = (fields: Record<string, string[]>) =>
    chunkAnswers(() => ({ status: 422, data: { contextId: 'context', error: 'validation_failed', fields } }))

  it.each([
    ['size', 'common.damImage.uploadErrors.size'],
    ['offset', 'common.damImage.uploadErrors.offset'],
    ['mimeType', 'common.damImage.uploadErrors.mimeType'],
  ])('is not tried again, and the row says what is wrong with its %s', async (field, message) => {
    invalid({ [field]: ['error_field_invalid'] })
    const { item, upload } = await started()

    expect(await outcome(upload())).toBe('rejected')

    expect(chunksSent()).toBe(1)
    expect(waits.passed).toEqual([])
    expect(item.error.message).toBe(commonT(message))
  })

  it('names a field it has no text for, and puts each field on a line of its own', async () => {
    invalid({ size: ['error_field_invalid'], checksum: ['error_one', 'error_two'] })
    const { item, upload } = await started()

    expect(await outcome(upload())).toBe('rejected')

    expect(item.error.message).toBe(
      [
        commonT('common.damImage.uploadErrors.size'),
        commonT('common.damImage.uploadErrors.systemError') + ': checksum - error_one,error_two',
      ].join(NEW_LINE_MARK)
    )
  })
})

describe('an upload stopped', () => {
  it('while a chunk is on its way: the request is cancelled and the chunk is not tried again', async () => {
    const chunks = dam.hold('POST', dam.routes.chunk)
    const { item, upload } = await started()
    const uploading = outcome(upload())
    await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))

    stop(item)

    expect(await uploading).toBe('rejected')
    expect(chunksSent()).toBe(1)
    expect(waits.passed).toEqual([])
    expect(finishesSent()).toBe(0)
  })

  it('in the pause before a chunk is tried again: no further request goes out', async () => {
    waits.restore()
    waits = holdLongWaits(1_000)
    chunkAnswers(noConnection)
    const { item, upload } = await started()
    const uploading = outcome(upload())
    await vi.waitFor(() => expect(waits.waiting()).toBe(1))
    expect(chunksSent()).toBe(1)

    stop(item)
    await waits.elapse()

    expect(await uploading).toBe('rejected')
    expect(chunksSent()).toBe(1)
    expect(finishesSent()).toBe(0)
  })

  it('once the last chunk is through: the upload is not finished', async () => {
    const { item, upload } = await started()
    chunkAnswers(() => {
      stop(item)
      return undefined
    })

    expect(await outcome(upload())).toBe('rejected')

    expect(chunksSent()).toBe(1)
    expect(finishesSent()).toBe(0)
    expect(item.status).toBe(UploadQueueItemStatus.Stop)
  })
})

// The speed is bytes over seconds between two progress reports of axios, averaged once a second; the queue shows
// it, and sizes the next chunk by it. Axios counts the bytes of each request from zero.
describe('the speed of an upload', () => {
  type Progress = (event: { loaded: number; total: number }) => void
  const realNow = Date.now
  /**
   * How far the test has moved the clock on, in ms: the seconds of a sample are the test's, and long enough for
   * those of the machine not to show in it.
   */
  let ahead = 0
  let reports: Array<{ speed: number; remaining: number }>

  beforeEach(() => {
    ahead = 0
    reports = []
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + ahead)
    // The second between two averages and the pause before a retry are both held, and let pass by the test.
    waits.restore()
    waits = holdLongWaits(1_000)
  })
  afterEach(() => {
    vi.mocked(Date.now).mockRestore()
  })

  const startedWithReports = async () => {
    const chunks = dam.hold('POST', dam.routes.chunk)
    const item = row()
    const { uploadInit, upload } = useUpload(item, (_percent: number, speed: number, remaining: number) =>
      reports.push({ speed, remaining })
    )
    await uploadInit()
    const uploading = outcome(upload())
    /** The chunk request on its way, and what axios reports of it. */
    const onItsWay = async () => {
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      const [held] = chunks.waiting
      return { held, progress: held.request.config.onUploadProgress as unknown as Progress }
    }
    return { uploading, onItsWay }
  }
  const speeds = () => reports.map((report) => report.speed)

  it('is measured anew when a chunk is sent again: the bytes of the try that failed are not counted back', async () => {
    const { uploading, onItsWay } = await startedWithReports()

    // The first try gets most of the chunk out, 900 bytes a second, and fails.
    const first = await onItsWay()
    first.progress({ loaded: 100, total: 1_000_000 })
    ahead += 1_000_000
    first.progress({ loaded: 900_000, total: 1_000_000 })
    first.held.release({ status: 503 })
    await vi.waitFor(() => expect(waits.waiting()).toBe(2))
    await waits.elapse()
    expect(speeds()).toEqual([900])

    // The retry starts from nothing. Counted from where the first try got to, its first report would be 890 000
    // bytes backwards.
    const second = await onItsWay()
    ahead += 100_000
    second.progress({ loaded: 10_000, total: 1_000_000 })
    await waits.elapse()
    expect(speeds()).toEqual([900, 900])

    ahead += 100_000
    second.progress({ loaded: 1_000_000, total: 1_000_000 })
    second.held.release()
    expect(await uploading).toBe('resolved')
    await waits.elapse()

    expect(reports).toHaveLength(3)
    expect(reports.every((report) => report.speed > 0 && Number.isFinite(report.speed))).toBe(true)
    expect(reports.every((report) => report.remaining >= 0)).toBe(true)
  })

  // Only a retry starts the measuring anew. The first try of the next chunk goes on from the last report of the
  // chunk before, the time between the two requests included. (Decision D4 of the upload plan: measuring anew
  // with every chunk is to come with the shared upload service; this case is then turned around.)
  it('goes on from the chunk before when the next chunk is sent for the first time', async () => {
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 3, maxSize: 3 }
    const { uploading, onItsWay } = await startedWithReports()

    const first = await onItsWay()
    first.progress({ loaded: 100, total: 1_000_000 })
    ahead += 1_000_000
    first.progress({ loaded: 1_000_000, total: 1_000_000 })
    first.held.release()

    const second = await onItsWay()
    ahead += 2_000_000
    second.progress({ loaded: 5_000_000, total: 10_000_000 })
    await waits.elapse()
    // 1000 bytes a second, then 2500: their average.
    expect(speeds()).toEqual([1750])

    second.held.release()
    expect(await uploading).toBe('resolved')
    expect(chunksSent()).toBe(2)
  })
})

// Without both there is nothing to send the chunks to, nor an asset to ask about. The upload used to go on: four
// "tries" of a chunk with their pauses, thirteen seconds in which no request went out, and then the failure.
describe('a start request that answers without an identifier', () => {
  it.each([
    ['the id of the file', { asset: 'asset-1' }],
    ['the id of the asset', { id: 'file-1' }],
    ['either', {}],
  ])(
    'without %s: the upload fails at once, as when the start is refused, and nothing is tried',
    async (_what, data) => {
      dam.reply((request) =>
        request.method === 'POST' && dam.routes.start.test(request.url) ? { status: 201, data } : undefined
      )
      const item = row()
      const { uploadInit, upload } = useUpload(item)

      // As the queue runs it: the chunks follow a start that went through, and here none does.
      expect(await outcome(uploadInit().then(() => upload()))).toBe('rejected')

      expect([item.assetId, item.fileId]).toEqual([null, null])
      // No pause of a retry was asked for.
      expect(waits.passed).toEqual([])
      expect(chunksSent()).toBe(0)
      expect(finishesSent()).toBe(0)
    }
  )
})
