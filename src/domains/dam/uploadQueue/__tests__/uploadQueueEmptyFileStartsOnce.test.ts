import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// A file of no bytes is refused under the set of the library, once its hash has loaded. Until then its row stays
// waiting, and the queue looks again after each file it adds: it is not started a second time meanwhile.

const rushaGate = vi.hoisted(() => {
  let open!: () => void
  const promise = new Promise<void>((resolve) => (open = resolve))
  return { promise, open }
})
// A hash is made for each run of an upload, once rusha has loaded.
const hashes = vi.hoisted(() => ({ made: 0 }))

// rusha is CommonJS and pre-bundled for the browser run: the factory returns what its `module.exports`
// would be, and the import sees that as `default`, as it does the real package.
vi.mock('rusha', async () => {
  await rushaGate.promise
  return {
    createHash: () => {
      hashes.made++
      return { update: () => undefined, digest: () => 'sha-of-file' }
    },
  }
})

const damUploadStart = vi.fn(async (_client: unknown, _endPoint: unknown, item: { file: File }) => ({
  asset: `asset-${item.file.name}`,
  id: `file-${item.file.name}`,
}))
const damUploadChunk = vi.fn(async () => ({}))
const damUploadFinish = vi.fn(async () => ({}))

vi.mock('@/domains/dam/api/uploadApi', () => ({
  damUploadStart: (...args: unknown[]) => damUploadStart(...(args as [unknown, unknown, { file: File }])),
  damUploadChunk: (...args: unknown[]) => damUploadChunk(...(args as [])),
  damUploadFinish: (...args: unknown[]) => damUploadFinish(...(args as [])),
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({}),
}))

vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({ addDamNotificationListener: () => undefined }),
}))

vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}) }),
}))

vi.mock('@/domains/dam/uploadQueue/utils/mimeTypeHelper', () => ({
  getAssetTypeByMimeType: () => DamAssetType.Image,
}))

vi.mock('@/domains/dam/uploadQueue/composables/damUploadChunkSize', () => ({
  useDamUploadChunkSize: () => ({ updateChunkSize: () => false, lastChunkSize: ref(1024) }),
}))

describe('an empty file of a queue while rusha loads', () => {
  it('is run once, while the file added after it starts, and fails', async () => {
    setActivePinia(createPinia())
    const store = useUploadQueuesStore()
    const empty = new File([], 'empty.jpg', { type: 'image/jpeg' })
    const photo = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })

    // The queue looks again once the photo is added: the empty file still waits there for its hash.
    await store.addByFiles('queue', 1, 1, [empty, photo], 'default')
    const [emptyRow] = store.getQueueItems('queue')
    expect(emptyRow!.status).toBe(UploadQueueItemStatus.Waiting)
    rushaGate.open()

    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 100))

    // One hash for each file: one run of each.
    expect(hashes.made).toBe(2)
    expect(damUploadStart.mock.calls.map(([, , item]) => item.file.name)).toEqual(['photo.jpg'])
    expect(emptyRow!.status).toBe(UploadQueueItemStatus.Failed)
  })
})
