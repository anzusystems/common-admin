import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
} from '@/domains/dam/types/UploadQueue'
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
// Every export is spelled out: `importOriginal` here closes an import cycle and stalls the browser runner.
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
const ASSET_GONE = 'common.damImage.queueItem.assetGone'
const warned = () => showWarningT.mock.calls.map(([key]) => key as string)

let wrapper: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
  showWarningT.mockClear()
  fetchAssetByFileId.mockReset()
})
afterEach(() => {
  // Also stops the queue of the last case, which is in the pinia the component mounts with.
  useUploadQueuesStore().stopUpload('q')
  wrapper?.unmount()
  wrapper = undefined
})

const processingItem = async () => {
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence('q', 1, 1, ['asset-1'], 'default')
  return store.getQueueItems('q')[0]!
}

describe('the refresh of an item of the upload queue', () => {
  it('gives an uploaded item still without its metadata the metadata and its form', async () => {
    fetchAsset.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    expect([item.canEditMetadata, item.customData]).toEqual([false, {}])

    const { refreshItem, refreshing } = useUploadQueueItemRefresh('default')
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
    [AssetFileProcessStatus.Stored, UploadQueueItemStatus.Processing, false, [STILL_PROCESSING]],
  ])('settles a processing item whose file is %s as %s', async (fileStatus, status, isDuplicate, warnings) => {
    fetchAsset.mockResolvedValue(asset(fileStatus))
    fetchAssetByFileId.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()

    await useUploadQueueItemRefresh('default').refreshItem('asset-1')

    expect([item.status, item.isDuplicate]).toEqual([status, isDuplicate])
    expect(warned()).toEqual(warnings)
  })

  it('can be asked for again when the asset cannot be read', async () => {
    fetchAsset
      .mockRejectedValueOnce(new Error('502 Bad Gateway'))
      .mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    const item = await processingItem()
    const { refreshItem, refreshing } = useUploadQueueItemRefresh('default')

    await expect(refreshItem('asset-1')).resolves.toBeUndefined()
    expect([refreshing.value, item.status]).toEqual([false, UploadQueueItemStatus.Processing])
    expect(warned()).toEqual([REFRESH_FAILED])

    await refreshItem('asset-1')
    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(warned()).toEqual([REFRESH_FAILED])
  })

  it('says the asset no longer exists when it is gone', async () => {
    fetchAsset.mockRejectedValue(new AnzuApiResponseCodeError(404))
    const item = await processingItem()

    await useUploadQueueItemRefresh('default').refreshItem('asset-1')

    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(warned()).toEqual([ASSET_GONE])
  })

  // The third read that finds no asset gives the item up. It fails and has no refresh left.
  it('says nothing on the press that finds the asset gone for the third time', async () => {
    fetchAsset.mockRejectedValue(new AnzuApiResponseCodeError(404))
    const item = await processingItem()
    const { refreshItem } = useUploadQueueItemRefresh('default')

    await refreshItem('asset-1')
    await refreshItem('asset-1')
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(warned()).toEqual([ASSET_GONE, ASSET_GONE])

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
      global: { stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
    // Use the pinia the component uses: mounting made it the active one.
    const item = await processingItem()
    await flushPromises()

    wrapper.findComponent(UploadQueueItemEditable).vm.$emit('refreshItem', { index: 0, assetId: 'asset-1' })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))

    expect(fetchAsset.mock.calls[0]![2]).toBe('asset-1')
  })

  // The queue says which row was pressed, and the message depends on that row.
  // The server has failed its file, so no refresh may change it, and a failed read is not followed by "try again".
  // The row before it, of another asset, waits on. Handed over in its place, it would be told to try again.
  it('hands the refresh the row that asked: one whose file the server failed is not told to try again', async () => {
    fetchAsset.mockReset()
    fetchAsset.mockRejectedValue(new Error('502 Bad Gateway'))
    wrapper = mount(UploadQueueEditable, {
      props: { queueKey: 'q', extSystem: 1, massOperations: false },
      global: { stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
    const store = useUploadQueuesStore()
    await store.addByCopyToLicence('q', 1, 1, ['asset-0', 'asset-1'], 'default')
    const [before, item] = store.getQueueItems('q')
    await flushPromises()
    expect([before!.assetId, item!.assetId]).toEqual(['asset-0', 'asset-1'])
    bus.listener!({
      name: DamNotificationName.AssetFileFailed,
      data: { asset: 'asset-1', failReason: AssetFileFailReason.InvalidMimeType },
    })
    await vi.waitFor(() => expect(item!.status).toBe(UploadQueueItemStatus.Failed))

    wrapper.findAllComponents(UploadQueueItemEditable)[1]!.vm.$emit('refreshItem', { index: 1, assetId: 'asset-1' })
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await flushPromises()

    expect(fetchAsset.mock.calls.map((call) => call[2])).toEqual(['asset-1'])
    expect([before!.status, item!.status]).toEqual([UploadQueueItemStatus.Processing, UploadQueueItemStatus.Failed])
    expect(warned()).toEqual([])
  })

  // The queue also says in which queue the row is. An uploaded row still without its metadata
  // keeps its status when taken out, so only its queue tells that nobody is left to try again.
  // Left in its queue, the same press with the same failed read is
  // told to. A wrongly named queue would take every row for gone.
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

// "Still uploading or processing" is shown only for a row the read found as it was.
// A row that ended during the refresh read, or was taken out of its queue, is not told this.
// Called without the row, the refresh cannot tell and shows it as before.
describe('the warning that the file of a pressed row is not done yet', () => {
  const mountList = () => {
    wrapper = mount(UploadQueueEditable, {
      props: { queueKey: 'q', extSystem: 1, massOperations: false },
      global: { stubs: { UploadQueueItemEditable: true, AssetQueueSelectedSidebar: true } },
    })
  }
  const holdRead = () => {
    const readsBefore = fetchAsset.mock.calls.length
    const held = {
      answer: (_asset: unknown) => {},
      started: () => expect(fetchAsset).toHaveBeenCalledTimes(readsBefore + 1),
    }
    fetchAsset.mockImplementation(() => new Promise((resolve) => (held.answer = resolve)))
    return held
  }
  const fromTheList = () =>
    wrapper!.findComponent(UploadQueueItemEditable).vm.$emit('refreshItem', { index: 0, assetId: 'asset-1' })
  const withTheRow = (item: UploadQueueItem) =>
    void useUploadQueueItemRefresh('default').refreshItem('asset-1', item, 'q')
  const withTheRowOnly = (item: UploadQueueItem) =>
    void useUploadQueueItemRefresh('default').refreshItem('asset-1', item)
  const withoutTheRow = () => void useUploadQueueItemRefresh('default').refreshItem('asset-1')
  const failedByItsNotification = async (item: UploadQueueItem) => {
    bus.listener!({
      name: DamNotificationName.AssetFileFailed,
      data: { asset: 'asset-1', id: 'file-1', failReason: AssetFileFailReason.InvalidSize },
    })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
  }
  const stopped = (item: UploadQueueItem) => useUploadQueuesStore().stopItemUpload('q', item)

  it.each([
    [
      'the list: not to a row its failed notification settles during the read',
      fromTheList,
      failedByItsNotification,
      UploadQueueItemStatus.Failed,
      [],
    ],
    [
      'the list: to a row the read finds still processing',
      fromTheList,
      undefined,
      UploadQueueItemStatus.Processing,
      [STILL_PROCESSING],
    ],
    [
      'the refresh given the row: not to a row settled during the read',
      withTheRow,
      failedByItsNotification,
      UploadQueueItemStatus.Failed,
      [],
    ],
    // Without the queue, the refresh cannot know the row is gone. A stopped row is enough.
    [
      'the refresh given the row and not its queue: not to a row stopped during the read',
      withTheRowOnly,
      stopped,
      UploadQueueItemStatus.Stop,
      [],
    ],
    [
      'the refresh given no row: as before, to a row settled during the read',
      withoutTheRow,
      failedByItsNotification,
      UploadQueueItemStatus.Failed,
      [STILL_PROCESSING],
    ],
  ])(
    'is said by %s',
    async (
      _what,
      press: (item: UploadQueueItem) => void,
      meanwhile: ((item: UploadQueueItem) => unknown) | undefined,
      status: UploadQueueItemStatusType,
      said: string[]
    ) => {
      mountList()
      const item = await processingItem()
      await flushPromises()
      const read = holdRead()

      press(item)
      await vi.waitFor(read.started)
      await meanwhile?.(item)
      read.answer(asset(AssetFileProcessStatus.Stored))
      await flushPromises()

      expect(item.status).toBe(status)
      expect(warned()).toEqual(said)
    }
  )

  // An uploaded row without metadata keeps its status when taken out. Only its queue can tell.
  it.each([
    ['still in the list is told the file is not done', false, [STILL_PROCESSING]],
    ['taken out of the list during the read is not told it', true, []],
  ])('is said to an uploaded row %s', async (_what, removed, said) => {
    fetchAsset.mockResolvedValue(asset(AssetFileProcessStatus.Processed))
    mountList()
    const item = await processingItem()
    bus.listener!({ name: DamNotificationName.AssetFileProcessed, data: { asset: 'asset-1' } })
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await flushPromises()
    const read = holdRead()

    fromTheList()
    await vi.waitFor(read.started)
    if (removed) useUploadQueuesStore().removeByIndex('q', 0)
    read.answer(asset(AssetFileProcessStatus.Stored))
    await flushPromises()

    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(useUploadQueuesStore().getQueueItems('q')).toHaveLength(removed ? 0 : 1)
    expect(warned()).toEqual(said)
  })
})
