import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import UploadQueueDialogSingleSidebar from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebar.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { immediateScheduler } from '@/domains/dam/uploadQueue/settlement/__tests__/support/immediateScheduler'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'

const bus = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
const options = vi.hoisted(() => ({ simpleAssetSidebarEnabled: false }))

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
const bulkUpdateAssetsMetadata = vi.fn(async (..._sent: unknown[]): Promise<unknown[]> => [])
vi.mock('@/domains/dam/api/damAssetApi', () => ({
  ENTITY: 'asset',
  fetchAsset: (...a: unknown[]) => fetchAsset(...a),
  fetchAssetByFileId: (...a: unknown[]) => fetchAssetByFileId(...a),
  useFetchAssetList: vi.fn(),
  fetchAssetAsCmsMedia: vi.fn(),
  bulkUpdateAssetsMetadata: (...a: unknown[]) => bulkUpdateAssetsMetadata(...a),
  fetchAssetListByIds: vi.fn(),
  updateAssetMetadata: vi.fn(),
  updateAssetAuthors: vi.fn(),
  bulkUpdateAssetsAuthors: vi.fn(),
  showMetadataSaveError: vi.fn(),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({
    damClient: () => ({}),
    endPointImage: '/image',
    endPointAsset: '/asset',
    mainFileSingleUseEnabled: true,
    simpleAssetSidebarEnabled: options.simpleAssetSidebarEnabled,
  }),
  useCommonAdminCoreDamOptionsGlobal: () => ({}),
}))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (bus.listener = callback),
  }),
}))

const showWarningT = vi.fn()
vi.mock('@/domains/system/composables/alerts', async (importOriginal) => {
  const original = await importOriginal<{ useAlerts: () => object }>()
  return {
    ...original,
    useAlerts: () => ({ ...original.useAlerts(), showWarningT: (key: string) => showWarningT(key) }),
  }
})

const EXT_SYSTEM = 1
const QUEUE = 'single'
const extSystemConfig = {
  image: {
    keywords: { enabled: true, required: false },
    authors: { enabled: true, required: false },
    customMetadataPinnedAmount: 2,
  },
} as unknown as DamExtSystemConfig

const asset = () => ({
  id: 'asset-1',
  mainFile: { id: 'file-1', links: {}, fileAttributes: { status: AssetFileProcessStatus.Processed } },
  attributes: { assetStatus: 'with_file', assetType: DamAssetType.Image },
  keywords: [],
  authors: [],
  metadata: { customData: { title: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
  mainFileSingleUse: false,
  mainFileInternal: null,
})
const notify = (name: string) => bus.listener!({ name, data: { asset: 'asset-1' } })

// The dialog waits twenty seconds before it offers refresh.
// Fake timers stall the browser runner, so only a wait that long is held back until the test lets it pass.
const realSetTimeout = window.setTimeout
const realClearTimeout = window.clearTimeout
const waits = new Map<number, { run: () => void; ms: number }>()
let lastWait = 1_000_000
const heldWaits = () => [...waits.values()].map((wait) => wait.ms)
const elapse = async () => {
  const due = [...waits.values()]
  waits.clear()
  due.forEach((wait) => wait.run())
  await flushPromises()
}

// The dialog is not about how the queue keeps time.
// The read a notification asks for comes at once, and the poll of the queue never.
const realScheduler = uploadSettlementRuntime.scheduler

let wrapper: VueWrapper | undefined
beforeEach(() => {
  uploadSettlementRuntime.scheduler = immediateScheduler()
  showWarningT.mockClear()
  fetchAsset.mockImplementation(async () => asset())
  fetchAssetByFileId.mockReset()
  options.simpleAssetSidebarEnabled = false
  window.setTimeout = ((run: () => void, ms?: number, ...rest: unknown[]) => {
    if ((ms ?? 0) < 10_000) return realSetTimeout(run, ms, ...rest)
    waits.set(++lastWait, { run, ms: ms! })
    return lastWait
  }) as typeof window.setTimeout
  window.clearTimeout = ((id?: number) => {
    if (id === undefined || !waits.delete(id)) realClearTimeout(id)
  }) as typeof window.clearTimeout
})
afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  uploadSettlementRuntime.scheduler = realScheduler
  useAssetDetailStore().reset()
  useAssetDetailStore().activeTab = AssetDetailTabImageWithRoi.Info
  const config = useDamConfigStore()
  config.damConfigExtSystem.delete(EXT_SYSTEM)
  config.damConfigAssetCustomFormElements.delete(EXT_SYSTEM)
  wrapper?.unmount()
  wrapper = undefined
  window.setTimeout = realSetTimeout
  window.clearTimeout = realClearTimeout
  waits.clear()
})

const mountWithItem = async (component: Parameters<typeof h>[0], props: Record<string, unknown>, stubs: string[]) => {
  const Host = defineComponent({
    setup() {
      const config = useDamConfigStore()
      config.damConfigExtSystem.set(EXT_SYSTEM, extSystemConfig)
      config.damConfigAssetCustomFormElements.set(EXT_SYSTEM, {
        [DamAssetType.Image]: [],
        [DamAssetType.Audio]: [],
        [DamAssetType.Video]: [],
        [DamAssetType.Document]: [],
      })
      return () => h(component, { queueKey: QUEUE, extSystem: EXT_SYSTEM, ...props })
    },
  })
  wrapper = mount(Host, {
    attachTo: document.body,
    global: { stubs: Object.fromEntries(stubs.map((name) => [name, true])) },
  })
  // Mounting made the pinia of the components the active one.
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(QUEUE, EXT_SYSTEM, 1, ['asset-1'], 'default')
  await flushPromises()
  return store.getQueueItems(QUEUE)[0]!
}

describe('the sidebar of the single-file upload dialog', () => {
  let handedOver: Record<string, unknown>
  const mountSidebar = (parts: Record<string, unknown> = {}) => {
    handedOver = reactive({
      assetId: 'asset-1',
      isVideo: false,
      isAudio: false,
      isImage: true,
      isDocument: false,
      enableRoiTab: true,
      showFileInfo: false,
      assetStatus: 'with_file',
      assetType: DamAssetType.Image,
      ...parts,
    })
    return mountWithItem(
      UploadQueueDialogSingleSidebar,
      handedOver,
      // The keyword and author inputs ask the API for their items when rendered. The region tab is not under test here.
      [
        'AFormRemoteAutocompleteWithCached',
        'AuthorRemoteAutocompleteCachedAuthorChipConflicts',
        'AssetDetailSidebarROI',
      ]
    )
  }
  // The dialog offers the region tab only once the item is uploaded and its asset read.
  // Until then the sidebar has its tabs, also in an application that asks for one without them.
  const mountSidebarOfUnfinished = () => mountSidebar({ enableRoiTab: false })
  const assetRead = async () => {
    handedOver.enableRoiTab = true
    await flushPromises()
  }
  const tabs = () => wrapper!.find('.sidebar-info__tabs')
  const refreshButton = () => wrapper!.find('[data-cy="button-refresh"]')
  const saveButtons = () =>
    ['button-save', 'button-save-and-apply'].map(
      (name) => (wrapper!.find(`[data-cy="${name}"]`).element as HTMLButtonElement).disabled
    )

  // Regression: the form stayed disabled, and both saves with it, so the uploaded image could not be used.
  it.each([
    ['with tabs', false],
    ['without tabs', true],
  ])('offers refresh on an uploaded item still without its metadata, which loads it (%s)', async (_name, simple) => {
    options.simpleAssetSidebarEnabled = simple
    const item = await mountSidebar()
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await flushPromises()
    expect(refreshButton().exists()).toBe(false)
    expect(saveButtons()).toEqual([true, true])
    expect(heldWaits()).toEqual([20_000])

    await elapse()
    expect(refreshButton().exists()).toBe(true)
    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    await flushPromises()

    expect(item.customData).toEqual({ title: 'from the server' })
    expect(refreshButton().exists()).toBe(false)
    expect(saveButtons()).toEqual([false, false])
  })

  it('does not offer it when the metadata comes before the wait is over', async () => {
    const item = await mountSidebar()
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await flushPromises()
    notify(DamNotificationName.AssetMetadataProcessed)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    await flushPromises()

    await elapse()
    expect(refreshButton().exists()).toBe(false)
  })

  // The buttons belong to the metadata tab, which is unmounted while the other tab is open.
  it('goes on waiting while the other tab is open', async () => {
    const item = await mountSidebar()
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    const detail = useAssetDetailStore()
    detail.activeTab = AssetDetailTabImageWithRoi.ROI
    await flushPromises()

    await elapse()
    detail.activeTab = AssetDetailTabImageWithRoi.Info
    await flushPromises()
    expect(refreshButton().exists()).toBe(true)
  })

  // The server can be slow to settle the file, and its notification can be lost.
  // The row of the queue dialog offers refresh for that, and so does this dialog.
  it.each([
    ['in an application whose sidebar has tabs', false],
    ['in one that asks for a sidebar without tabs', true],
  ])('offers refresh on an item the server is still processing, which settles it (%s)', async (_name, simple) => {
    options.simpleAssetSidebarEnabled = simple
    const item = await mountSidebarOfUnfinished()
    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(tabs().exists()).toBe(true)
    expect(refreshButton().exists()).toBe(false)
    expect(heldWaits()).toEqual([20_000])

    await elapse()
    expect(refreshButton().exists()).toBe(true)
    expect(saveButtons()).toEqual([true, true])
    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await assetRead()

    expect(fetchAsset).toHaveBeenCalledWith(expect.anything(), '/asset', 'asset-1')
    expect(item.customData).toEqual({ title: 'from the server' })
    expect(tabs().exists()).toBe(!simple)
    expect(refreshButton().exists()).toBe(false)
    expect(saveButtons()).toEqual([false, false])
    expect(heldWaits()).toEqual([])
  })

  it('keeps offering it while the server answers that the file is not processed yet', async () => {
    const item = await mountSidebarOfUnfinished()
    fetchAsset.mockImplementation(async () => ({
      ...asset(),
      mainFile: { ...asset().mainFile, fileAttributes: { status: AssetFileProcessStatus.Stored } },
    }))
    await elapse()

    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalled())
    await flushPromises()

    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect(refreshButton().exists()).toBe(true)
    expect((refreshButton().element as HTMLButtonElement).disabled).toBe(false)
  })

  it('says the state could not be loaded when the refresh cannot read the asset, and goes on offering it', async () => {
    const item = await mountSidebarOfUnfinished()
    fetchAsset.mockRejectedValue(new Error('502 Bad Gateway'))
    await elapse()

    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(showWarningT.mock.calls).toEqual([['common.damImage.queueItem.refreshFailed']]))
    await flushPromises()

    expect(item.status).toBe(UploadQueueItemStatus.Processing)
    expect((refreshButton().element as HTMLButtonElement).disabled).toBe(false)
  })

  // The file is a duplicate whose original cannot be read, so the press fails the item.
  // A failed item whose refresh may still help is offered it, as its
  // row in the queue is (finding 25). The press says why it could not.
  it('says why when the refresh itself fails the item, and still offers it', async () => {
    const item = await mountSidebarOfUnfinished()
    fetchAsset.mockImplementation(async () => ({
      ...asset(),
      mainFile: {
        ...asset().mainFile,
        originAssetFile: 'file-original',
        fileAttributes: { status: AssetFileProcessStatus.Duplicate },
      },
    }))
    fetchAssetByFileId.mockRejectedValue(new Error('502 Bad Gateway'))
    await elapse()

    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()

    expect(fetchAssetByFileId).toHaveBeenCalledTimes(1)
    expect(showWarningT.mock.calls).toEqual([['common.damImage.queueItem.duplicateOriginalUnread']])
    expect(refreshButton().exists()).toBe(true)
  })

  it('offers it to a failed item whose refresh may still help, and reads again when pressed', async () => {
    const item = await mountSidebarOfUnfinished()
    fetchAsset.mockImplementation(async () => ({
      ...asset(),
      mainFile: {
        ...asset().mainFile,
        originAssetFile: 'file-original',
        fileAttributes: { status: AssetFileProcessStatus.Duplicate },
      },
    }))
    fetchAssetByFileId.mockRejectedValueOnce(new Error('502 Bad Gateway'))
    await elapse()
    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Failed))
    await flushPromises()
    expect(useUploadQueuesStore().refreshMayHelp(item)).toBe(true)
    expect(refreshButton().exists()).toBe(true)
    const readsBefore = fetchAsset.mock.calls.length
    fetchAssetByFileId.mockResolvedValue(asset())

    await refreshButton().trigger('click')
    await flushPromises()

    expect(fetchAsset.mock.calls.length).toBeGreaterThan(readsBefore)
    expect(fetchAssetByFileId).toHaveBeenCalledTimes(2)
  })

  // An uploaded item still without its metadata keeps its status when taken out of the queue.
  // The sidebar says in which queue it was pressed, so nobody is told to try again on an item that is gone.
  it('says nothing when the item was taken out of its queue while its refresh was on its way', async () => {
    const item = await mountSidebarOfUnfinished()
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await assetRead()
    await elapse()
    expect(refreshButton().exists()).toBe(true)
    const readsBefore = fetchAsset.mock.calls.length
    let failRead = (_reason: Error) => {}
    fetchAsset.mockImplementation(() => new Promise((_resolve, reject) => (failRead = reject)))

    await refreshButton().trigger('click')
    await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalledTimes(readsBefore + 1))
    useUploadQueuesStore().removeByIndex(QUEUE, 0)
    failRead(new Error('502 Bad Gateway'))
    await flushPromises()

    expect(item.status).toBe(UploadQueueItemStatus.Uploaded)
    expect(showWarningT).not.toHaveBeenCalled()
  })

  it('does not offer it when the item is settled before the wait is over', async () => {
    const item = await mountSidebarOfUnfinished()
    notify(DamNotificationName.AssetMetadataProcessed)
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect([item.status, item.canEditMetadata]).toEqual([UploadQueueItemStatus.Uploaded, true]))
    await assetRead()

    expect(heldWaits()).toEqual([])
    await elapse()
    expect(refreshButton().exists()).toBe(false)
  })

  it('takes it back when the item turns uploaded, and waits anew for its metadata', async () => {
    const item = await mountSidebarOfUnfinished()
    await elapse()
    expect(refreshButton().exists()).toBe(true)

    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    await assetRead()
    expect(refreshButton().exists()).toBe(false)
    expect(heldWaits()).toEqual([20_000])

    await elapse()
    expect(refreshButton().exists()).toBe(true)
  })

  it.each([
    ['is still being sent', UploadQueueItemStatus.Uploading],
    ['waits its turn', UploadQueueItemStatus.Waiting],
    ['has failed', UploadQueueItemStatus.Failed],
  ])('does not offer it for an item that %s', async (_what, status) => {
    const item = await mountSidebarOfUnfinished()
    item.status = status
    await flushPromises()

    expect(heldWaits()).toEqual([])
    await elapse()
    expect(refreshButton().exists()).toBe(false)
  })

  // The form is enabled once the metadata is there, which can be while the file still sends or processes.
  it('keeps the single-use switch as the user set it when the asset detail is loaded afterwards', async () => {
    const item = await mountSidebar()
    notify(DamNotificationName.AssetMetadataProcessed)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    await flushPromises()
    const singleUse = () => wrapper!.find('.v-switch input').element as HTMLInputElement
    expect(singleUse().checked).toBe(false)

    await wrapper!.find('.v-switch input').setValue(true)
    expect(item.mainFileSingleUse).toBe(true)
    useAssetDetailStore().setAsset(asset() as never)
    await flushPromises()

    expect(singleUse().checked).toBe(true)
    expect(item.mainFileSingleUse).toBe(true)
  })

  // Several authors of that name: the store finds them when it loads the item's metadata.
  // The list of the asset detail, which this input read before, is filled by nothing.
  it('offers the author conflicts of the item', async () => {
    const item = await mountSidebar()
    notify(DamNotificationName.AssetMetadataProcessed)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    await flushPromises()
    const offered = () => wrapper!.findAllComponents(AuthorRemoteAutocompleteCachedAuthorChipConflicts)
    expect(offered()).toHaveLength(0)

    item.authorConflicts = ['author-1', 'author-2']
    await flushPromises()

    expect(offered().map((chip) => chip.props('id'))).toEqual(['author-1', 'author-2'])
  })
})

describe('the single-file upload dialog', () => {
  it.each([
    ['is single use', true, false, true],
    ['is not', false, true, false],
  ])(
    'says of a duplicate whether its original %s, whatever the switch is set to',
    async (_name, originalIsSingleUse, switchedTo, shown) => {
      fetchAssetByFileId.mockResolvedValue({ ...asset(), mainFileSingleUse: originalIsSingleUse })
      const item = await mountWithItem(
        UploadQueueDialogSingle,
        { licenceId: 1, fileInputKey: 0, accept: undefined, maxSizes: undefined },
        [
          'UploadQueueDialogSingleSidebarMetadata',
          'AssetDetailSidebarROI',
          'AssetImage',
          'UploadQueueButtonStop',
          'DamAssetImageRoiSelectLazy',
        ]
      )
      await useUploadQueuesStore().queueItemDuplicate('asset-1', 'file-original', DamAssetType.Image, 'default')
      await flushPromises()
      // The dialog renders into the body.
      const notice = () => document.body.querySelector('.text-body-small.text-error')
      expect([item.isDuplicate, !!notice()]).toEqual([true, shown])

      item.mainFileSingleUse = switchedTo
      await flushPromises()
      expect(!!notice()).toBe(shown)
    }
  )

  it.each(['save', 'saveAndApply'] as const)('sends the single-use switch of the item on %s', async (event) => {
    const item = await mountWithItem(
      UploadQueueDialogSingle,
      { licenceId: 1, fileInputKey: 0, accept: undefined, maxSizes: undefined },
      ['UploadQueueDialogSingleSidebar', 'AssetImage', 'UploadQueueButtonStop', 'DamAssetImageRoiSelectLazy']
    )
    notify(DamNotificationName.AssetMetadataProcessed)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    // Set while the file is still processing. The asset the dialog then loads says otherwise.
    item.mainFileSingleUse = true
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(useAssetDetailStore().asset?.id).toBe('asset-1'))
    expect(useAssetDetailStore().mainFileSingleUse).toBe(false)

    wrapper!.findComponent(UploadQueueDialogSingleSidebar).vm.$emit(event)
    await vi.waitFor(() => expect(bulkUpdateAssetsMetadata).toHaveBeenCalled())

    expect(bulkUpdateAssetsMetadata.mock.calls[0]![3]).toBe(true)
  })
})
