import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DamAssetType } from '@/types/coreDam/Asset'
import { UploadQueueItemStatus } from '@/types/coreDam/UploadQueue'
import { AssetFileProcessStatus } from '@/types/coreDam/AssetFile'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { DamNotificationName } from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
const state = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
vi.mock('@/components/damImage/uploadQueue/api/damImageApi', () => ({
  fetchImageFile: vi.fn(),
  imageUploadStart: vi.fn(),
  imageUploadChunk: vi.fn(),
  imageUploadFinish: vi.fn(async () => ({})),
  rotateImage: vi.fn(),
  copyToLicence: vi.fn(),
}))
const fetchAsset = vi.fn()
vi.mock('@/components/damImage/uploadQueue/api/damAssetApi', () => ({
  ENTITY: 'asset',
  fetchAsset: (...a: unknown[]) => fetchAsset(...a),
  fetchAssetByFileId: vi.fn(),
  useFetchAssetList: vi.fn(),
  fetchAssetAsCmsMedia: vi.fn(),
  bulkUpdateAssetsMetadata: vi.fn(),
  fetchAssetListByIds: vi.fn(),
  updateAssetMetadata: vi.fn(),
  updateAssetAuthors: vi.fn(),
  bulkUpdateAssetsAuthors: vi.fn(),
}))
vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: true }),
}))
vi.mock('@/components/damImage/uploadQueue/composables/damNotifications', () => ({
  useDamNotifications: () => ({ addDamNotificationListener: (cb: (e: unknown) => void) => (state.listener = cb) }),
}))
vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}) }),
}))
const asset = (id: string, status: string) => ({
  id,
  mainFile: { id: `file-of-${id}`, links: {}, fileAttributes: { status } },
  attributes: { assetStatus: 'with_file', assetType: DamAssetType.Image },
  keywords: [],
  authors: [],
  metadata: { customData: {}, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: null,
  mainFileInternal: null,
})
const realSetTimeout = window.setTimeout
beforeEach(() => {
  setActivePinia(createPinia())
  window.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) =>
    realSetTimeout(fn, (ms ?? 0) < 10_000 ? ms : 300, ...rest)) as typeof window.setTimeout
})
afterEach(() => {
  window.setTimeout = realSetTimeout
})
const settle = (ms: number) => new Promise((r) => realSetTimeout(r, ms))
describe('a failed asset fetch on a copied or duplicate item', () => {
  it('a copy the notification path failed is not later uploaded-with-error', async () => {
    fetchAsset
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValue(asset('asset-1', AssetFileProcessStatus.Processed))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    state.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await settle(50)
    const item = store.getQueueItems('q')[0]!
    expect(item.status).toBe(UploadQueueItemStatus.Failed)
    await settle(800)
    expect([item.status, item.error.hasError]).not.toEqual([UploadQueueItemStatus.Uploaded, true])
  })
  it('a settled copy is not failed by a late notification whose fetch fails', async () => {
    fetchAsset
      .mockResolvedValueOnce(asset('asset-1', AssetFileProcessStatus.Processed))
      .mockResolvedValueOnce(asset('asset-1', AssetFileProcessStatus.Processed))
      .mockRejectedValueOnce(new Error('502'))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const item = store.getQueueItems('q')[0]!
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded), { timeout: 2000 })
    state.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await settle(50)
    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
  })
})
