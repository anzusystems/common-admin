import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// rusha is CommonJS and pre-bundled for the browser run: the factory returns what its `module.exports`
// would be, and the import sees that as `default`, as it does the real package.
vi.mock('rusha', () => ({ createHash: () => ({ update: () => undefined, digest: () => 'sha' }) }))

const bus = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (bus.listener = callback),
  }),
}))

// Each chunk waits until the test lets that file's request answer.
const release = new Map<string, () => void>()
const damUploadStart = vi.fn(async (_c: unknown, _e: unknown, item: UploadQueueItem) => ({
  asset: `asset-${item.file!.name}`,
  id: `file-${item.file!.name}`,
}))
const damUploadChunk = vi.fn(
  (_c: unknown, _e: unknown, item: UploadQueueItem) =>
    new Promise((resolve) => release.set(item.file!.name, () => resolve({})))
)
// As the real one: a finished upload leaves "uploading" for "processing".
const damUploadFinish = vi.fn(async (_c: unknown, _a: unknown, _i: unknown, item: UploadQueueItem) => {
  item.status = UploadQueueItemStatus.Processing
  return {}
})
vi.mock('@/domains/dam/api/uploadApi', () => ({
  damUploadStart: (...a: unknown[]) => damUploadStart(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadChunk: (...a: unknown[]) => damUploadChunk(...(a as [unknown, unknown, UploadQueueItem])),
  damUploadFinish: (...a: unknown[]) => damUploadFinish(...(a as [unknown, unknown, unknown, UploadQueueItem])),
  armNotificationFallback: vi.fn(),
}))

const assetWithFile = async (_c: unknown, _e: unknown, id: string) => ({
  id,
  mainFile: { id: 'f', links: {} },
  attributes: { assetStatus: 'with_file' },
})
const fetchAsset = vi.fn(assetWithFile)
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAsset: (...a: unknown[]) => fetchAsset(...(a as [unknown, unknown, string])),
}))

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

beforeEach(() => {
  setActivePinia(createPinia())
  release.clear()
  fetchAsset.mockImplementation(assetWithFile)
})

describe('a zero-byte file in the upload queue', () => {
  it('fails the item instead of leaving the queue waiting for it forever', async () => {
    const store = useUploadQueuesStore()
    const empty = new File([], 'empty.jpg', { type: 'image/jpeg' })

    await store.addByFiles('q', 1, 1, [empty])

    await vi.waitFor(() => expect(store.getQueueItems('q')[0].status).toBe(UploadQueueItemStatus.Failed), {
      timeout: 1000,
    })
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
    expect(damUploadStart).not.toHaveBeenCalled()
  })
})

describe('an asset copied to the licence whose detail fails to load', () => {
  it('ends up marked as failed rather than processing forever', async () => {
    fetchAsset.mockRejectedValue(new Error('502 Bad Gateway'))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const item = store.getQueueItems('q')[0]
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    // Copied items get no notification fallback timer: the notification is all there is.
    expect(item.notificationFallbackTimer).toBeUndefined()

    bus.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await settle()

    expect(item.error.hasError).toBe(true)
    expect(store.getQueueProcessedCount('q')).toBe(store.getQueueTotalCount('q'))
  })
})

describe('upload queue parallel limit', () => {
  it('never runs more than two uploads at once', async () => {
    const store = useUploadQueuesStore()
    const files = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => new File(['x'], `${n}.jpg`, { type: 'image/jpeg' }))
    const uploading = () => store.getQueueItems('q').filter((i) => i.status === UploadQueueItemStatus.Uploading).length

    await store.addByFiles('q', 1, 1, files)
    await vi.waitFor(() => expect(release.size).toBe(2))
    expect(uploading()).toBe(2)

    // a finishes: one slot frees up, so exactly one more file may start.
    release.get('a.jpg')!()
    await vi.waitFor(() => expect(damUploadFinish).toHaveBeenCalledTimes(1))
    await settle()
    const afterFinish = uploading()

    // The DAM notification for a arrives while the others are still sending.
    await store.queueItemProcessed('asset-a.jpg')
    await settle()
    expect([afterFinish, uploading()]).toEqual([2, 2])
  })
})
