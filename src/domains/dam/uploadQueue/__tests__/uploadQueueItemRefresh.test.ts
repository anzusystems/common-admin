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
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'

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
  useCommonAdminCoreDamOptionsGlobal: () => ({}),
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

const STILL_PROCESSING = 'common.damImage.queueItem.stillUploadingOrProcessing'
const REFRESH_FAILED = 'common.damImage.queueItem.refreshFailed'
/** The warnings the user was shown, by their keys. */
const warned = () => showWarningT.mock.calls.map(([key]) => key as string)

let wrapper: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
  showWarningT.mockClear()
  fetchAssetByFileId.mockReset()
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
    [AssetFileProcessStatus.Processed, UploadQueueItemStatus.Uploaded, false, []],
    [AssetFileProcessStatus.Duplicate, UploadQueueItemStatus.Uploaded, true, []],
    [AssetFileProcessStatus.Failed, UploadQueueItemStatus.Failed, false, []],
    // The file is not done: the item waits on, and the user is told that, not that the read failed.
    [AssetFileProcessStatus.Stored, UploadQueueItemStatus.Processing, false, [STILL_PROCESSING]],
  ])('settles a processing item whose file is %s as %s', async (fileStatus, status, isDuplicate, warnings) => {
    fetchAsset.mockResolvedValue(asset(fileStatus))
    fetchAssetByFileId.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()

    await useUploadQueueItemRefresh().refreshItem('asset-1')

    expect([item.status, item.isDuplicate]).toEqual([status, isDuplicate])
    expect(warned()).toEqual(warnings)
  })

  it('can be asked for again when the asset cannot be read', async () => {
    fetchAsset
      .mockRejectedValueOnce(new Error('502 Bad Gateway'))
      .mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()
    const { refreshItem, refreshing } = useUploadQueueItemRefresh()

    await expect(refreshItem('asset-1')).resolves.toBeUndefined()
    expect([refreshing.value, item.status]).toEqual([false, UploadQueueItemStatus.Processing])
    // Nothing about the item changed: the user is told why, not left to press again and wonder.
    expect(warned()).toEqual([REFRESH_FAILED])

    await refreshItem('asset-1')
    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(warned()).toEqual([REFRESH_FAILED])
  })

  it('says the state could not be loaded when the asset is gone as well', async () => {
    fetchAsset.mockRejectedValue(new AnzuApiResponseCodeError(404))
    const item = await processingItem()

    await useUploadQueueItemRefresh().refreshItem('asset-1')

    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(warned()).toEqual([REFRESH_FAILED])
  })

  // The third read that finds no asset gives the item up: it fails, and has no refresh left to try again with.
  it('does not say to try again on the press that finds the asset gone for the third time', async () => {
    fetchAsset.mockRejectedValue(new AnzuApiResponseCodeError(404))
    const item = await processingItem()
    const { refreshItem } = useUploadQueueItemRefresh()

    await refreshItem('asset-1')
    await refreshItem('asset-1')
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(warned()).toEqual([REFRESH_FAILED, REFRESH_FAILED])

    await refreshItem('asset-1')

    expect(item.status).toBe(UploadQueueItemStatus.Failed)
    expect(warned()).toHaveLength(2)
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

  // The queue says which row was pressed: a press that fails that row is not followed by "try again". The row
  // before it, of another asset, waits on: handed over in its place, it would be told to.
  it('hands the refresh the row that asked: one the refresh itself fails is not told to try again', async () => {
    fetchAsset.mockResolvedValue(asset(AssetFileProcessStatus.Duplicate))
    fetchAssetByFileId.mockRejectedValue(new Error('502 Bad Gateway'))
    wrapper = mount(UploadQueueEditable, {
      props: { queueKey: 'q', extSystem: 1, massOperations: false },
      global: { stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-0', 'asset-1'])
    const [before, item] = store.getQueueItems('q')
    await flushPromises()
    expect([before!.assetId, item!.assetId]).toEqual(['asset-0', 'asset-1'])

    wrapper.findAllComponents(UploadQueueItemEditable)[1]!.vm.$emit('refreshItem', { index: 1, assetId: 'asset-1' })
    await vi.waitFor(() => expect(item!.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()

    expect(fetchAssetByFileId).toHaveBeenCalledTimes(1)
    expect(before!.status).toBe(UploadQueueItemStatus.Processing)
    expect(warned()).toEqual([])
  })

  // And in which queue: an uploaded row still without its metadata keeps its status when it is taken out, and only
  // its queue tells that nobody is left to try again. Left in its queue, the same press with the same failed read
  // is told to: a queue named wrongly would take every row for gone, and the queue would never say it.
  it.each([
    ['still in it is told the state could not be loaded', false, [REFRESH_FAILED]],
    ['taken out of it meanwhile is not told to try again', true, []],
  ])('says in which queue the row was pressed: one %s', async (_what, removed, said) => {
    fetchAsset.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    wrapper = mount(UploadQueueEditable, {
      props: { queueKey: 'q', extSystem: 1, massOperations: false },
      global: { stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
    const item = await processingItem()
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    // The read the notification asks for is over before the refresh is pressed.
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await flushPromises()
    expect(item.canEditMetadata).toBe(false)
    const readsBefore = fetchAsset.mock.calls.length
    let failRead = (_reason: Error) => {}
    fetchAsset.mockImplementation(() => new Promise((_resolve, reject) => (failRead = reject)))

    wrapper.findComponent(UploadQueueItemEditable).vm.$emit('refreshItem', { index: 0, assetId: 'asset-1' })
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalledTimes(readsBefore + 1))
    if (removed) useUploadQueuesStore().removeByIndex('q', 0)
    failRead(new Error('502 Bad Gateway'))
    await flushPromises()

    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(useUploadQueuesStore().getQueueItems('q')).toHaveLength(removed ? 0 : 1)
    expect(warned()).toEqual(said)
  })
})
