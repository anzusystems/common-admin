import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
const state = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
vi.mock('@/domains/dam/api/damImageApi', () => ({
  fetchImageFile: vi.fn(),
  imageUploadStart: vi.fn(),
  imageUploadChunk: vi.fn(),
  imageUploadFinish: vi.fn(async () => ({})),
  rotateImage: vi.fn(),
  copyToLicence: vi.fn(),
}))
const fetchAsset = vi.fn()
vi.mock('@/domains/dam/api/damAssetApi', () => ({
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
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointImage: '/image', endPointAsset: '/asset' }),
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: true }),
}))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({ addDamNotificationListener: (cb: (e: unknown) => void) => (state.listener = cb) }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
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
  it('a copy the notification path failed stays failed: the fallback does not settle it later', async () => {
    fetchAsset
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValue(asset('asset-1', AssetFileProcessStatus.Processed))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    state.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await settle(50)
    const item = store.getQueueItems('q')[0]!
    expect(item.status).toBe(UploadQueueItemStatus.Failed)
    // The fallback's wait is over by now, and its asset would answer as processed.
    await settle(800)
    expect(item.status).toBe(UploadQueueItemStatus.Failed)
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
