import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/types/coreDam/UploadQueue'
import { useUpload } from '@/components/damImage/uploadQueue/composables/uploadService'

// rusha, which hashes the upload, is imported when a file starts uploading, before its asset is created.
// Until the first chunk goes out there is no request for Stop to cancel, so the upload has to notice the
// stop itself -- rather than create the asset, send every chunk and finish what the user stopped.

// rusha is CommonJS and pre-bundled for the browser run: the factory returns what its `module.exports`
// would be, and the import sees that as `default`, as it does the real package.
vi.mock('rusha', () => ({ createHash: () => ({ update: () => undefined, digest: () => 'sha-of-file' }) }))

const damUploadStart = vi.fn(async () => ({ asset: 'asset-1', id: 'file-1' }))
const damUploadChunk = vi.fn(async () => ({}))
const damUploadFinish = vi.fn(async () => ({}))

vi.mock('@/components/damImage/uploadQueue/api/uploadApi', () => ({
  damUploadStart: (...args: unknown[]) => damUploadStart(...(args as [])),
  damUploadChunk: (...args: unknown[]) => damUploadChunk(...(args as [])),
  damUploadFinish: (...args: unknown[]) => damUploadFinish(...(args as [])),
}))

vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
}))

vi.mock('@/components/damImage/uploadQueue/composables/damUploadChunkSize', () => ({
  useDamUploadChunkSize: () => ({ updateChunkSize: () => false, lastChunkSize: ref(1024) }),
}))

const queueItem = () =>
  ({
    file: new File(['file content'], 'photo.jpg', { type: 'image/jpeg' }),
    status: UploadQueueItemStatus.Waiting,
    progress: { speed: null },
    error: { hasError: false, message: '' },
    latestChunkCancelToken: null,
  }) as unknown as UploadQueueItem

describe('an upload stopped before its first chunk', () => {
  it('creates no asset when stopped while rusha loads', async () => {
    const item = queueItem()
    const { uploadInit } = useUpload(item)

    // The import takes at least a tick, so the stop lands while it is pending.
    const initializing = uploadInit()
    item.status = UploadQueueItemStatus.Stop

    await expect(initializing).rejects.toThrow('Upload stopped')
    expect(damUploadStart).not.toHaveBeenCalled()
    expect(damUploadChunk).not.toHaveBeenCalled()
  })

  it('sends no chunk when stopped while the asset was being created', async () => {
    const item = queueItem()
    const { uploadInit, upload } = useUpload(item)
    await uploadInit()
    item.status = UploadQueueItemStatus.Stop

    await expect(upload()).rejects.toThrow('Upload stopped')
    expect(damUploadChunk).not.toHaveBeenCalled()
    expect(damUploadFinish).not.toHaveBeenCalled()
  })

  it('uploads and finishes with the hash when nobody stops it', async () => {
    const item = queueItem()
    const { uploadInit, upload } = useUpload(item)
    await uploadInit()

    await upload()
    expect(damUploadStart).toHaveBeenCalledTimes(1)
    expect(damUploadChunk).toHaveBeenCalledTimes(1)
    expect(damUploadFinish).toHaveBeenCalledTimes(1)
    expect(damUploadFinish.mock.calls[0]).toContain('sha-of-file')
  })
})
