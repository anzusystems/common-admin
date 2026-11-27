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
    // Nothing is said in the row: the queue marks it failed and the row shows its general error.
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

// The speed is the bytes of the file sent in the last ten seconds,
// from the first chunk request on, reported once a second.
// The queue shows it and sizes the next chunk by it. Axios counts the bytes of each request from zero.
describe('the speed of an upload', () => {
  type Progress = (event: { loaded: number; total: number }) => void
  let ahead = 0
  let reports: Array<{ percent: number; speed: number; remaining: number }>

  beforeEach(() => {
    ahead = 0
    reports = []
    const start = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => start + ahead)
    waits.restore()
    waits = holdLongWaits(1_000)
  })
  afterEach(() => {
    vi.mocked(Date.now).mockRestore()
  })

  const startedWithReports = async (size: number) => {
    const chunks = dam.hold('POST', dam.routes.chunk)
    const item = row()
    item.file = new File([new Uint8Array(size)], 'photo.jpg', { type: 'image/jpeg' })
    const { uploadInit, upload } = useUpload(item, (percent: number, speed: number, remaining: number) =>
      reports.push({ percent, speed, remaining })
    )
    await uploadInit()
    const uploading = outcome(upload())
    const onItsWay = async () => {
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      const [held] = chunks.waiting
      return { held, progress: held.request.config.onUploadProgress as unknown as Progress }
    }
    return { uploading, onItsWay }
  }
  it('is measured anew when a chunk is sent again: the try that failed is not counted, and the share does not go back', async () => {
    const { uploading, onItsWay } = await startedWithReports(10_000)

    const first = await onItsWay()
    ahead += 1_000
    first.progress({ loaded: 9_000, total: 10_000 })
    await waits.elapse()
    expect(reports).toEqual([{ percent: 90, speed: 9_000, remaining: 1 }])
    first.held.release({ status: 503 })
    await vi.waitFor(() => expect(waits.waiting()).toBe(2))

    ahead += 1_000
    await waits.elapse()
    expect(reports).toHaveLength(1)

    // The retry starts counting from zero. Counted from where the first try got to, it would be 7 000 bytes backwards.
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

    expect(reports.at(-1)).toEqual({ percent: 100, speed: 5_000, remaining: 0 })
    expect(reports).toHaveLength(3)
  })

  // Only a retry restarts the measuring. The first try of the next chunk continues
  // from the answer to the previous chunk, so the server's answer time is counted.
  it('goes on from the chunk before when the next chunk is sent for the first time', async () => {
    useDamConfigStore().damPrvConfig.settings.imageChunkConfig = { minSize: 10_000, maxSize: 10_000 }
    const { uploading, onItsWay } = await startedWithReports(20_000)

    const first = await onItsWay()
    ahead += 1_000
    first.progress({ loaded: 10_000, total: 10_000 })
    ahead += 1_000
    first.held.release()

    const second = await onItsWay()
    ahead += 1_000
    second.progress({ loaded: 8_000, total: 10_000 })
    await waits.elapse()
    // 18 000 bytes in three seconds. Measured anew for the second chunk it
    // would be 8 000 a second; without the second of the answer, 9 000.
    expect(reports).toEqual([{ percent: 90, speed: 6_000, remaining: 1 }])

    second.held.release()
    expect(await uploading).toBe('resolved')
    expect(chunksSent()).toBe(2)
  })
})

// Without both identifiers there is nothing to send chunks to or to ask about.
// Regression guard: the upload used to go on with four chunk "tries"
// and their pauses, 13 seconds without any request, and then failed.
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

      expect(await outcome(uploadInit().then(() => upload()))).toBe('rejected')

      expect([item.assetId, item.fileId]).toEqual([null, null])
      expect(waits.passed).toEqual([])
      expect(chunksSent()).toBe(0)
      expect(finishesSent()).toBe(0)
    }
  )
})
