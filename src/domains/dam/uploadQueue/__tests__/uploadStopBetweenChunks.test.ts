import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import axios from 'axios'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { uploadStop, useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'

vi.mock('rusha', () => ({ createHash: () => ({ update: () => undefined, digest: () => 'sha' }) }))

// What uploadQueuesStore.stopItemUpload does to an item.
const stop = (item: UploadQueueItem) => {
  item.status = UploadQueueItemStatus.Stop
  if (item.latestChunkAbortController) uploadStop(item.latestChunkAbortController)
}
// As axios does: a request dispatched on an aborted signal rejects before it goes out.
let onChunk: (item: UploadQueueItem) => Promise<unknown> = async () => ({})
const damUploadChunk = vi.fn(async (_c: unknown, _e: unknown, item: UploadQueueItem) => {
  if (item.latestChunkAbortController?.signal.aborted) throw new axios.CanceledError()
  return onChunk(item)
})
const damUploadFinish = vi.fn(async () => ({}))
vi.mock('@/domains/dam/api/uploadApi', () => ({
  damUploadStart: vi.fn(async () => ({ asset: 'asset-1', id: 'file-1' })),
  damUploadChunk: (...a: unknown[]) => damUploadChunk(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadFinish: (...a: unknown[]) => damUploadFinish(...(a as [])),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
}))
vi.mock('@/domains/dam/uploadQueue/composables/damUploadChunkSize', () => ({
  useDamUploadChunkSize: () => ({ updateChunkSize: () => false, lastChunkSize: ref(1024) }),
}))

const threeChunkItem = () =>
  ({
    file: new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' }),
    status: UploadQueueItemStatus.Waiting,
    progress: { speed: null },
    error: { hasError: false, message: '' },
    latestChunkAbortController: null,
  }) as unknown as UploadQueueItem
const outcome = (p: Promise<unknown>, ms: number) =>
  Promise.race([
    p.then(
      () => 'resolved',
      () => 'rejected'
    ),
    new Promise((r) => setTimeout(() => r('pending'), ms)),
  ])

describe('Stop on a multi-chunk upload', () => {
  it('sends no further chunk and does not finish when stopped between chunks', async () => {
    const item = threeChunkItem()
    // The first chunk's response is in; Stop lands before the second chunk starts.
    onChunk = async (i) => {
      if (damUploadChunk.mock.calls.length === 1) stop(i)
      return {}
    }
    const { uploadInit, upload } = useUpload(item)
    await uploadInit()

    expect(await outcome(upload(), 1000)).toBe('rejected')
    expect(damUploadChunk).toHaveBeenCalledTimes(1)
    expect(damUploadFinish).not.toHaveBeenCalled()
  })

  it('gives up at once when Stop cancels the chunk in flight', async () => {
    const item = threeChunkItem()
    onChunk = async (i) => {
      stop(i)
      throw new axios.CanceledError()
    }
    const { uploadInit, upload } = useUpload(item)
    await uploadInit()

    expect(await outcome(upload(), 1500)).toBe('rejected')
    expect(damUploadChunk).toHaveBeenCalledTimes(1)
  })
})
