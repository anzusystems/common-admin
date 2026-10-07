import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import UploadQueueEditable from '@/domains/dam/uploadQueue/components/UploadQueueEditable.vue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueueItemRefresh } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const bus = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))

vi.mock('@/domains/dam/api/damImageApi', () => ({
  fetchImageFile: vi.fn(),
  imageUploadStart: vi.fn(),
  imageUploadChunk: vi.fn(),
  imageUploadFinish: vi.fn(async () => ({})),
  rotateImage: vi.fn(),
  copyToLicence: vi.fn(),
}))
// Every export spelled out: `importOriginal` here closes an import cycle and stalls the browser runner.
const fetchAsset = vi.fn()
const fetchAssetByFileId = vi.fn()
vi.mock('@/domains/dam/api/damAssetApi', () => ({
  ENTITY: 'asset',
  fetchAsset: (...a: unknown[]) => fetchAsset(...a),
  fetchAssetByFileId: (...a: unknown[]) => fetchAssetByFileId(...a),
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
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
}))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (bus.listener = callback),
  }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}) }),
}))
const showWarningT = vi.fn()
vi.mock('@/domains/system/composables/alerts', async (importOriginal) => {
  const original = await importOriginal<{ useAlerts: () => object }>()
  return {
    ...original,
    useAlerts: () => ({ ...original.useAlerts(), showWarningT: (key: string) => showWarningT(key) }),
  }
})

const asset = (status: string) => ({
  id: 'asset-1',
  mainFile: {
    id: 'file-1',
    links: {},
    originAssetFile: 'file-original',
    fileAttributes: { status, failReason: AssetFileFailReason.InvalidMimeType },
  },
  attributes: { assetStatus: 'with_file', assetType: DamAssetType.Image },
  keywords: [],
  authors: [],
  metadata: { customData: { title: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: null,
  mainFileInternal: null,
})

let wrapper: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  // Also the queue of the last case, which is in the pinia the component mounts with.
  useUploadQueuesStore().stopUpload('q')
  wrapper?.unmount()
  wrapper = undefined
})

/** A copy to the licence: an item that is processing, with its asset and nothing else. */
const processingItem = async () => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence('q', 1, 1, ['asset-1'])
  return store.getQueueItems('q')[0]!
}

describe('the refresh of an item of the upload queue', () => {
  // Its processed notification came and its metadata never did: the form is disabled, and the save skips the item.
  it('gives an uploaded item still without its metadata the metadata and its form', async () => {
    fetchAsset.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    expect([item.canEditMetadata, item.customData]).toEqual([false, {}])

    const { refreshItem, refreshing } = useUploadQueueItemRefresh()
    const refreshed = refreshItem('asset-1')
    expect(refreshing.value).toBe(true)
    await refreshed

    expect(refreshing.value).toBe(false)
    expect(item.canEditMetadata).toBe(true)
    expect(item.customData).toEqual({ title: 'from the server' })
  })

  it.each([
    [AssetFileProcessStatus.Processed, UploadQueueItemStatus.Uploaded, false, 0],
    [AssetFileProcessStatus.Duplicate, UploadQueueItemStatus.Uploaded, true, 0],
    [AssetFileProcessStatus.Failed, UploadQueueItemStatus.Failed, false, 0],
    // The file is not done: the item waits on, and the user is told.
    [AssetFileProcessStatus.Stored, UploadQueueItemStatus.Processing, false, 1],
  ])('settles a processing item whose file is %s as %s', async (fileStatus, status, isDuplicate, warnings) => {
    fetchAsset.mockResolvedValue(asset(fileStatus))
    fetchAssetByFileId.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()

    await useUploadQueueItemRefresh().refreshItem('asset-1')

    expect([item.status, item.isDuplicate]).toEqual([status, isDuplicate])
    expect(showWarningT).toHaveBeenCalledTimes(warnings)
  })

  it('can be asked for again when the asset cannot be read', async () => {
    fetchAsset
      .mockRejectedValueOnce(new Error('502 Bad Gateway'))
      .mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()
    const { refreshItem, refreshing } = useUploadQueueItemRefresh()

    await expect(refreshItem('asset-1')).resolves.toBeUndefined()
    expect([refreshing.value, item.status]).toEqual([false, UploadQueueItemStatus.Processing])

    await refreshItem('asset-1')
    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
  })
})

describe('the upload queue', () => {
  it('refreshes the item whose row asked for it', async () => {
    fetchAsset.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    wrapper = mount(UploadQueueEditable, {
      props: { queueKey: 'q', extSystem: 1, massOperations: false },
      // The rows and the mass operations read the configuration of the ext system, which is not what is asked here.
      global: { stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
    // In the pinia the component uses: mounting made it the active one.
    const item = await processingItem()
    await flushPromises()

    wrapper.findComponent(UploadQueueItemEditable).vm.$emit('refreshItem', { index: 0, assetId: 'asset-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(fetchAsset.mock.calls[0]![2]).toBe('asset-1')
  })
})
