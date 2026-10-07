import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
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

const bus = vi.hoisted(() => ({ listener: undefined as undefined | ((event: unknown) => void) }))
// The sidebar without tabs, which an admin can ask for.
const options = vi.hoisted(() => ({ simpleAssetSidebarEnabled: false }))

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
  useCommonAdminCoreDamOptionsGlobal: () => ({ uploadStatusFallback: false }),
}))
vi.mock('@/domains/dam/composables/damNotifications', () => ({
  useDamNotifications: () => ({
    addDamNotificationListener: (callback: (event: unknown) => void) => (bus.listener = callback),
  }),
}))

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

// The dialog waits twenty seconds before it offers refresh. Fake timers stall the browser runner, so only a wait
// that long is held back, until the test lets it pass.
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

let wrapper: VueWrapper | undefined
beforeEach(() => {
  fetchAsset.mockImplementation(async () => asset())
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
  // The stores are those of the pinia every test of this file mounts with.
  useUploadQueuesStore().stopUpload(QUEUE)
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

/** Mounts `component` and puts one item into its queue: a copy to the licence, processing, with its asset. */
const mountWithItem = async (component: Parameters<typeof h>[0], props: Record<string, unknown>, stubs: string[]) => {
  const Host = defineComponent({
    setup() {
      // The configuration the form reads, in the pinia the components use.
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
  // Mounting made the components' pinia the active one.
  const store = useUploadQueuesStore()
  await store.addByCopyToLicence(QUEUE, EXT_SYSTEM, 1, ['asset-1'])
  await flushPromises()
  return store.getQueueItems(QUEUE)[0]!
}

describe('the sidebar of the single-file upload dialog', () => {
  const mountSidebar = () =>
    mountWithItem(
      UploadQueueDialogSingleSidebar,
      {
        assetId: 'asset-1',
        isVideo: false,
        isAudio: false,
        isImage: true,
        isDocument: false,
        enableRoiTab: true,
        showFileInfo: false,
        assetStatus: 'with_file',
        assetType: DamAssetType.Image,
      },
      // What the keyword and author inputs render asks the API for its items; the region tab is not what is asked
      // here.
      [
        'AFormRemoteAutocompleteWithCached',
        'AuthorRemoteAutocompleteCachedAuthorChipConflicts',
        'AssetDetailSidebarROI',
      ]
    )
  const refreshButton = () => wrapper!.find('[data-cy="button-refresh"]')
  const saveButtons = () =>
    ['button-save', 'button-save-and-apply'].map(
      (name) => (wrapper!.find(`[data-cy="${name}"]`).element as HTMLButtonElement).disabled
    )

  // Its form stays disabled and both saves with it, so the uploaded image could not be used at all.
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

  // The buttons belong to the metadata tab, which is unmounted while the other one is open.
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
    // What the dialog does when the item turns uploaded.
    useAssetDetailStore().setAsset(asset() as never)
    await flushPromises()

    expect(singleUse().checked).toBe(true)
    expect(item.mainFileSingleUse).toBe(true)
  })

  // Several authors of that name: the store finds them when it loads the item's metadata. The list of the asset
  // detail, which this input read, is filled by nothing.
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
  // Saving a duplicate saves into its original: the notice says what that asset is, and stays.
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
        // The sidebar itself is mounted: the notice is in its slot.
        [
          'UploadQueueDialogSingleSidebarMetadata',
          'AssetDetailSidebarROI',
          'AssetImage',
          'UploadQueueButtonStop',
          'DamAssetImageRoiSelectLazy',
        ]
      )
      await useUploadQueuesStore().queueItemDuplicate('asset-1', 'file-original', DamAssetType.Image)
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
      // The parts of the dialog that have no say in what is sent.
      ['UploadQueueDialogSingleSidebar', 'AssetImage', 'UploadQueueButtonStop', 'DamAssetImageRoiSelectLazy']
    )
    notify(DamNotificationName.AssetMetadataProcessed)
    await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
    // Set while the file was still processing; the asset the dialog then loads says otherwise.
    item.mainFileSingleUse = true
    notify(DamNotificationName.AssetFileProcessed)
    await vi.waitFor(() => expect(useAssetDetailStore().asset?.id).toBe('asset-1'))
    expect(useAssetDetailStore().mainFileSingleUse).toBe(false)

    wrapper!.findComponent(UploadQueueDialogSingleSidebar).vm.$emit(event)
    await vi.waitFor(() => expect(bulkUpdateAssetsMetadata).toHaveBeenCalled())

    expect(bulkUpdateAssetsMetadata.mock.calls[0]![3]).toBe(true)
  })
})
