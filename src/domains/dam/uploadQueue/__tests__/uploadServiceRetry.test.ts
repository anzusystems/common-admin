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

// The speed is the bytes of the file sent in the last ten seconds, from the request of its first chunk on, reported
// once a second; the queue shows it, and sizes the next chunk by it. Axios counts the bytes of each request from zero.
describe('the speed of an upload', () => {
  type Progress = (event: { loaded: number; total: number }) => void
  /** How far the test has moved the clock on, in ms. The clock stands otherwise: the seconds are the test's. */
  let ahead = 0
  let reports: Array<{ percent: number; speed: number; remaining: number }>

  beforeEach(() => {
    ahead = 0
    reports = []
    const start = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => start + ahead)
    // The second between two reports and the pause before a retry are both held, and let pass by the test.
    waits.restore()
    waits = holdLongWaits(1_000)
  })
  afterEach(() => {
    vi.mocked(Date.now).mockRestore()
  })

  /** A file of the given number of bytes. */
  const startedWithReports = async (size: number) => {
    const chunks = dam.hold('POST', dam.routes.chunk)
    const item = row()
    item.file = new File([new Uint8Array(size)], 'photo.jpg', { type: 'image/jpeg' })
    const { uploadInit, upload } = useUpload(item, (percent: number, speed: number, remaining: number) =>
      reports.push({ percent, speed, remaining })
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
  it('is measured anew when a chunk is sent again: the try that failed is not counted, and the share does not go back', async () => {
    // One chunk of 10 000 bytes.
    const { uploading, onItsWay } = await startedWithReports(10_000)

    // The first try gets most of the chunk out in a second, counted from its request, and fails.
    const first = await onItsWay()
    ahead += 1_000
    first.progress({ loaded: 9_000, total: 10_000 })
    await waits.elapse()
    expect(reports).toEqual([{ percent: 90, speed: 9_000, remaining: 1 }])
    first.held.release({ status: 503 })
    await vi.waitFor(() => expect(waits.waiting()).toBe(2))

    // The pause before the retry: no speed, so no report, and the row keeps the last.
    ahead += 1_000
    await waits.elapse()
    expect(reports).toHaveLength(1)

    // The retry starts from nothing. Counted from where the first try got to, it would be 7 000 bytes backwards.
    const second = await onItsWay()
    ahead += 1_000
    second.progress({ loaded: 2_000, total: 10_000 })
    await waits.elapse()
    expect(reports.at(-1)).toEqual({ percent: 90, speed: 2_000, remaining: 4 })

    ahead += 1_000
    second.progress({ loaded: 10_000, total: 10_000 })
    second.held.release()
    expect(await uploading).toBe('resolved')
    await waits.elapse()

    // The whole file in the two seconds of the retry.
    expect(reports.at(-1)).toEqual({ percent: 100, speed: 5_000, remaining: 0 })
    expect(reports).toHaveLength(3)
  })

  // Only a retry starts the measuring anew. The first try of the next chunk goes on from the answer to the chunk
  // before: the time the server took to answer is counted.
  it('goes on from the chunk before when the next chunk is sent for the first time', async () => {
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 10_000, maxSize: 10_000 }
    const { uploading, onItsWay } = await startedWithReports(20_000)

    // The first chunk is out in a second, and answered a second later.
    const first = await onItsWay()
    ahead += 1_000
    first.progress({ loaded: 10_000, total: 10_000 })
    ahead += 1_000
    first.held.release()

    const second = await onItsWay()
    ahead += 1_000
    second.progress({ loaded: 8_000, total: 10_000 })
    await waits.elapse()
    // 18 000 bytes in three seconds. Measured anew for the second chunk, it would be 8 000 a second; without the
    // second of the answer, 9 000.
    expect(reports).toEqual([{ percent: 90, speed: 6_000, remaining: 1 }])

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
