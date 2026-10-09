import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
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
  useCommonAdminCoreDamOptionsGlobal: () => ({}),
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
// The reads are timed by the queue: the one a notification asks for a moment after it, the poll five seconds after
// the row began to wait.
const realScheduler = uploadSettlementRuntime.scheduler
let clock: ManualScheduler
beforeEach(() => {
  setActivePinia(createPinia())
  fetchAsset.mockReset()
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
})
afterEach(() => {
  useUploadQueuesStore().stopUpload('q')
  uploadSettlementRuntime.scheduler = realScheduler
})
describe('a failed asset fetch on a copied or duplicate item', () => {
  // The read failed, not the copy: failed for it, a copy the server had made was out of reach.
  it('a copy whose read after its notification failed waits on, and the poll settles it', async () => {
    fetchAsset
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValue(asset('asset-1', AssetFileProcessStatus.Processed))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    state.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await clock.advance(1000)
    const item = store.getQueueItems('q')[0]!
    expect(fetchAsset).toHaveBeenCalledTimes(1)
    expect([item.status, item.error.hasError]).toEqual([UploadQueueItemStatus.Processing, false])
    // The first read of its queue is due by now, and its asset answers as processed.
    await clock.advance(4000)
    expect([item.status, item.fileId]).toEqual([UploadQueueItemStatus.Uploaded, 'file-of-asset-1'])
  })
  it('a settled copy is not failed by a late notification whose fetch fails', async () => {
    fetchAsset
      .mockResolvedValueOnce(asset('asset-1', AssetFileProcessStatus.Processed))
      .mockRejectedValue(new Error('502'))
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
    const item = store.getQueueItems('q')[0]!
    await clock.advance(5000)
    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    state.listener!({ name: DamNotificationName.AssetFileCopied, data: { asset: 'asset-1' } })
    await clock.advance(1000)
    expect(fetchAsset).toHaveBeenCalledTimes(2)
    expect([item.status, item.error.hasError]).toEqual([UploadQueueItemStatus.Uploaded, false])
  })
})
