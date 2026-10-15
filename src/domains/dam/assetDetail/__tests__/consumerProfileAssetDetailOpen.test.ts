import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  damText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DocId, IntegerId } from '@/shared/types/common'

// The detail of an asset as each of its four hosts opens it, under each of the two applications: "edit asset" of a
// row of the gallery, of the dialog of the image in each of the two widgets of one image, and of a row of the queue
// dialog, whose detail its host draws (here the gallery). A host opens the detail before it reads the asset. What
// the detail does when that read fails, when its answer comes after the detail was closed from its loader, and when
// two reads overlap: a read that failed used to leave the page under a dialog that drew nothing and that nothing
// closed, and the store of the detail, one for the page, took every answer whenever it came. And what becomes of the
// detail when its host goes away with it open: its key used to stay in that store. The real hosts with the
// real dialog of the detail in its real frame; the DAM and the backend of the images are clients that record their
// requests, and only the long waits are taken out of real time. Not mounted for real: the sortable list around the
// rows of the gallery, the asset pickers, the pictures, the editor of the region of interest with its regions, the
// dropzones, the mass operations of the queue dialog, and the inputs that ask the DAM for names to offer.

const QUEUE = 'detail-host'
const TITLE = 'Harbour at dawn'
// A licence of another ext system than the one of the page.
const OTHER = 300003
const OTHER_EXT_SYSTEM = 7
const { Processing, Uploaded } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let socket: DamSocket
let page: VueWrapper | undefined

const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
// The list editor around the rows of the gallery: only its view is drawn.
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})
const STAND_INS = {
  ASortableListEditor: Editor,
  AAssetSelect: Picker,
  AAssetSelectMedia: Picker,
  AImageWidgetSimple: true,
  AssetImage: true,
  VImg: true,
  DamAssetImageRoiSelectLazy: true,
  AssetDetailSidebarROI: true,
  AssetQueueSelectedSidebar: true,
  AFileDropzone: true,
  AFormRemoteAutocompleteWithCached: true,
}
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const buttonOf = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === text)

interface Host {
  name: string
  /** Whether the host has the page ask for names under the ext system of the licence of the asset it shows. */
  namesExtSystem: boolean
  /** The asset "edit asset" opens the detail of. */
  asset: DocId
  /** What the host reads that asset with. */
  read: () => string
  /** The page as it is when the user can press "edit asset". */
  mount: () => Promise<void>
  /** The same page mounted once more, after the first has gone away: as `mount`, where nothing else is named. */
  mountAgain?: () => Promise<void>
  /** The asset "edit asset" opens the detail of on the page mounted once more: `asset`, where nothing else is named. */
  assetAgain?: DocId
  /** What the host reads that asset with: as `read`, where nothing else is named. */
  readAgain?: () => string
  editAsset: () => HTMLButtonElement
}

describe.each(consumerProfiles)('the detail of an asset as its hosts open it, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const isCms = profile === cmsConfiguration

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    // The search of the DAM for assets by their files, which the gallery asks before it reads the assets.
    const search = new RegExp(`^${escaped(endPoints.asset)}/licence/(\\d+)/search\\?assetAndMainFileIds=([^&]*)`)
    dam.reply((request) => {
      const match = request.method === 'GET' ? request.url.match(search) : null
      if (!match) return undefined
      const files = match[2]!.split(',')
      const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
      return { status: 200, data: { data: found, totalCount: found.length } }
    })
    // The other licence is of another ext system, configured as the one of the page.
    const config = useDamConfigStore(pinia)
    config.damConfigLicenceExtSystem.set(OTHER, { name: '', extSystem: OTHER_EXT_SYSTEM })
    config.damConfigExtSystem.set(OTHER_EXT_SYSTEM, config.damConfigExtSystem.get(extSystem)!)
    config.damConfigAssetCustomFormElements.set(
      OTHER_EXT_SYSTEM,
      config.damConfigAssetCustomFormElements.get(extSystem)!
    )
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
    if (isCms) signInToDam(extSystem)
  })
  afterEach(() => {
    page?.unmount()
    page = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    useUploadQueueDialog().uploadQueueDialog.value = null
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const detail = () => useAssetDetailStore(pinia)
  const pageExtSystem = () => useExtSystemIdForCached().cachedExtSystemId
  /** An image the entity already has: `file-<id>` of `asset-<id>`. */
  const stored = (id: number): ImageAware => ({
    id,
    texts: { description: `image ${id}`, source: `source ${id}` },
    dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  })
  /** An asset as the DAM answers it: an image with its file processed. */
  const inTheDam = (id: DocId, title = TITLE, of: IntegerId = licence) =>
    damAssetWithFile(id, `file-${id.replace('asset-', '')}`, AssetFileProcessStatus.Processed, {
      licence: of,
      texts: { displayTitle: title },
    })
  const mountPage = async (component: Component, props: Record<string, unknown>) => {
    page = mount(component, {
      attachTo: document.body,
      props: { queueKey: QUEUE, uploadLicence: licence, selectLicences: [licence], ...props } as never,
      global: {
        plugins: [pinia],
        provide: {
          [ImageWidgetUploadConfigKey as symbol]: shallowRef({
            licence,
            extSystem,
            licenceName: '',
            extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
          }),
        },
        stubs: STAND_INS,
      },
    })
    await flushPromises()
  }
  /** The gallery of an entity that has the given images. */
  const mountGallery = async (ids: number[]) => {
    ids.forEach((id) => {
      imageApi.has(stored(id))
      dam.assets.set(`asset-${id}`, inTheDam(`asset-${id}`))
    })
    await mountPage(ImageWidgetMultipleInner, { modelValue: ids, skipCurrentUserCheck: !isCms })
    await vi.waitFor(() => expect(useImageStore(pinia).images).toHaveLength(ids.length))
    await damNamesAsked()
    await flushPromises()
  }
  // The dialog of the image of a widget of one image is drawn into the body.
  const imageDialog = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(damText('image.meta.edit'))
    )
  /** A widget of one image that has an image, with the dialog of that image open. */
  const mountWithImageDialog = async (component: Component, props: Record<string, unknown>) => {
    imageApi.has(stored(12))
    dam.assets.set('asset-12', inTheDam('asset-12'))
    await mountPage(component, { expandOptions: true, ...props })
    const editImage = () => page!.findAll('button').find((button) => button.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(editImage()).toBeDefined())
    await editImage()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
    await flushPromises()
  }
  const queueStatuses = () =>
    useUploadQueuesStore(pinia)
      .getQueueItems(QUEUE)
      .map((item) => item.status)
  const queueRows = () => document.body.querySelectorAll('.overlay--sidebar .dam-upload-queue__item')
  /** A file picked in the gallery, uploaded and processed by the DAM: `asset` is made of it. */
  const uploadThroughGallery = async (asset: DocId) => {
    const input = (page!.element as Element).querySelector<HTMLInputElement>('input[type="file"]')!
    const picked = new DataTransfer()
    picked.items.add(new File([new Uint8Array(3000)], 'a.jpg', { type: 'image/jpeg' }))
    input.files = picked.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.waitFor(() => expect(queueStatuses()).toEqual([Processing]))
    dam.fileBecomes(asset, AssetFileProcessStatus.Processed, {
      texts: { displayTitle: TITLE },
      metadata: { customData: { description: 'uploaded' }, authorSuggestions: {}, keywordSuggestions: {} },
    })
    await waits.elapse()
    await vi.waitFor(() => expect(queueStatuses()).toEqual([Uploaded]))
    await damNamesAsked()
    await flushPromises()
  }

  const hosts: Host[] = [
    {
      name: '"edit asset" of a row of the gallery',
      namesExtSystem: true,
      asset: 'asset-12',
      read: () => `${endPoints.asset}/asset-file/file-12`,
      mount: () => mountGallery([12]),
      editAsset: () =>
        buttonOf(
          page!.findAllComponents(ImageWidgetMultipleItem)[0]!.element,
          useCommonAdminCoreDamOptions().editAssetLabel
        )!,
    },
    {
      name: '"edit asset" of the dialog of the image of the image widget',
      namesExtSystem: true,
      asset: 'asset-12',
      read: () => `${endPoints.asset}/asset-file/file-12`,
      mount: () => mountWithImageDialog(ImageWidgetInner, { modelValue: 12, skipCurrentUserCheck: !isCms }),
      editAsset: () => buttonOf(imageDialog()!, useCommonAdminCoreDamOptions().editAssetLabel)!,
    },
    {
      name: '"edit asset" of the dialog of the image of the image and media widget',
      namesExtSystem: true,
      asset: 'asset-12',
      read: () => `${endPoints.asset}/asset-file/file-12`,
      mount: () => mountWithImageDialog(ImageMediaWidgetInner, { image: 12, media: null }),
      editAsset: () => buttonOf(imageDialog()!, useCommonAdminCoreDamOptions().editAssetLabel)!,
    },
    {
      // The row of a file uploaded through the gallery: the first file the DAM is sent is `file-1` of `asset-1`.
      name: '"edit asset" of a row of the queue dialog',
      namesExtSystem: false,
      asset: 'asset-1',
      read: () => `${endPoints.asset}/asset-1`,
      mount: async () => {
        await mountGallery([])
        await uploadThroughGallery('asset-1')
      },
      // The queue is the app's and still holds the row of the first file; the gallery drawn again does not open its
      // dialog (it forgot itself as it went with the gallery before). The way back to a row is the user's: a new file
      // uploaded through the gallery, the second the DAM is sent. It stops the queue no dialog names first: in the
      // dialog it opens, the row of the new file is the only one.
      mountAgain: async () => {
        await mountGallery([])
        expect([queueStatuses(), queueRows().length]).toEqual([[Uploaded], 0])
        await uploadThroughGallery('asset-2')
        const assetsOfRows = useUploadQueuesStore(pinia)
          .getQueueItems(QUEUE)
          .map((item) => item.assetId)
        expect([assetsOfRows, queueRows().length]).toEqual([['asset-2'], 1])
      },
      assetAgain: 'asset-2',
      readAgain: () => `${endPoints.asset}/asset-2`,
      editAsset: () =>
        buttonOf(
          document.body.querySelector<HTMLElement>('.overlay--sidebar .dam-upload-queue__item')!,
          damText('image.button.editAsset')
        )!,
    },
  ]

  // The detail is drawn into the body: its loader, or the asset.
  const card = () => document.body.querySelector<HTMLElement>('.dam-image-detail')
  const assetDrawn = () => !!card()?.querySelector('.dam-image-detail__left')
  const loaderDrawn = () => !!card()?.querySelector('.v-progress-circular') && !assetDrawn()
  const heading = () => card()?.querySelector('.v-toolbar')?.textContent ?? ''
  const activeOverlays = () => Array.from(document.body.querySelectorAll('.v-overlay--active'))
  /** Whether a click at the middle of the element lands on it: nothing lies over it. */
  const reachable = (element: Element) => {
    element.scrollIntoView({ block: 'center' })
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return !!hit && element.contains(hit)
  }
  const press = async (button: HTMLButtonElement) => {
    button.click()
    await flushPromises()
  }
  const closeFromLoader = async () => {
    expect(loaderDrawn()).toBe(true)
    await press(card()!.querySelector<HTMLButtonElement>(`button[aria-label="${uiText('common.button.close')}"]`)!)
  }
  /** What the DAM was asked since, but for the names of authors and keywords, which the caches ask in their own time. */
  const askedSince = (from: number) =>
    dam.requests
      .slice(from)
      .filter((request) => !DAM_NAMES.test(request.url))
      .map((request) => `${request.method} ${request.url}`)
  const readOf = (host: Host) => new RegExp(`^${escaped(host.read())}$`)
  const refuse = (host: Host, status: number) =>
    dam.reply((request) => (request.method === 'GET' && request.url === host.read() ? { status } : undefined))
  const failureSaid = [['error', alertText('common.alert.unknownError')]]

  describe.each(hosts)('opened by $name', (host) => {
    // The path that did not change: one read, and the asset it answers with.
    it('shows the asset the DAM answers with, read once as before', async () => {
      await host.mount()
      // Whatever another widget of the page has left there.
      pageExtSystem().value = OTHER_EXT_SYSTEM
      const before = dam.requests.length

      await press(host.editAsset())
      await vi.waitFor(() => expect(detail().asset?.id).toBe(host.asset))
      await flushPromises()

      expect(askedSince(before)).toEqual([`GET ${host.read()}`])
      expect([detail().dialog, detail().loading]).toEqual([QUEUE, false])
      expect(assetDrawn()).toBe(true)
      expect(heading()).toContain(TITLE)
      expect(pageExtSystem().value).toBe(host.namesExtSystem ? extSystem : OTHER_EXT_SYSTEM)
      expect(shownAlerts()).toEqual([])
    })

    // The detail used to stay: a dialog over the whole window that drew neither its loader nor an asset, and that
    // neither Esc nor a click outside closes. Only a reload of the page took it away.
    it.each<[string, number]>([
      ['is gone from the DAM', 404],
      ['cannot be read', 500],
    ])(
      'closes by itself when its asset %s: the failure is said once, and nothing is left over the page',
      async (_what, status) => {
        await host.mount()
        const overlaysBefore = activeOverlays()
        const answerAgain = refuse(host, status)

        await press(host.editAsset())
        await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
        await waits.settle()

        expect(shownAlerts()).toEqual(failureSaid)
        expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
        expect(card()).toBeNull()
        // The overlays that were there before, and no other.
        expect(activeOverlays().map((overlay) => overlaysBefore.indexOf(overlay))).toEqual(
          overlaysBefore.map((_, index) => index)
        )
        expect(reachable(host.editAsset())).toBe(true)

        // The page goes on: once the DAM answers, "edit asset" opens the detail.
        answerAgain()
        await press(host.editAsset())
        await vi.waitFor(() => expect(detail().asset?.id).toBe(host.asset))
        await flushPromises()
        expect(heading()).toContain(TITLE)
        expect(shownAlerts()).toEqual(failureSaid)
      }
    )

    // The store of the detail is one for the page. The answer used to be written into it whenever it came, and
    // stayed: the next detail showed that asset when its own read failed.
    it('takes nothing of an answer that comes after it was closed from its loader, and the next detail shows nothing of it', async () => {
      await host.mount()
      const extSystemBefore = pageExtSystem().value
      const held = dam.hold('GET', readOf(host))
      await press(host.editAsset())
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

      await closeFromLoader()
      expect([detail().dialog, detail().loading]).toEqual([null, false])
      expect(card()).toBeNull()
      // The answer names an asset of another licence, of another ext system.
      held.release({ status: 200, data: inTheDam('asset-late', 'The late one', OTHER) })
      await waits.settle()

      expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
      expect(card()).toBeNull()
      expect(pageExtSystem().value).toBe(extSystemBefore)

      refuse(host, 500)
      await press(host.editAsset())
      await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
      await waits.settle()

      expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
      expect(card()).toBeNull()
      expect(shownAlerts()).toEqual(failureSaid)
    })

    // Closed from its loader and opened again, the detail has two reads on their way. The older answer used to be
    // shown as well: for good when it came last, and whichever came first turned the loader off.
    it.each<[string, boolean]>([
      ['the older answer comes first', true],
      ['the newer answer comes first', false],
    ])(
      'shows the asset of the read it was opened with last, when two reads overlap and %s',
      async (_what, olderFirst) => {
        await host.mount()
        const older = { status: 200, data: inTheDam('asset-older', 'The older one', OTHER) }
        const newer = { status: 200, data: inTheDam('asset-newer', 'The newer one') }
        const held = dam.hold('GET', readOf(host))
        await press(host.editAsset())
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        const first = held.waiting[0]!
        await closeFromLoader()
        await press(host.editAsset())
        await vi.waitFor(() => expect(held.waiting).toHaveLength(2))
        const second = held.waiting[1]!

        if (olderFirst) {
          first.release(older)
          await waits.settle()
          // Not the answer the detail waits for: it goes on loading, and the page asks for names as it did.
          expect([detail().dialog, detail().asset, detail().loading]).toEqual([QUEUE, null, true])
          expect(loaderDrawn()).toBe(true)
          expect(pageExtSystem().value).toBe(extSystem)
          second.release(newer)
        } else {
          second.release(newer)
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-newer'))
          first.release(older)
        }
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-newer'))
        await waits.settle()

        expect([detail().dialog, detail().asset?.id, detail().loading]).toEqual([QUEUE, 'asset-newer', false])
        expect(assetDrawn()).toBe(true)
        expect(heading()).toContain('The newer one')
        expect(pageExtSystem().value).toBe(extSystem)
        expect(shownAlerts()).toEqual([])
      }
    )

    // The failure of the older read is said, as every failed read was. It is not the read the open detail waits
    // for: that detail neither closes nor stops loading.
    it('goes on loading when an older read fails, and shows its asset once its own read answers', async () => {
      await host.mount()
      const held = dam.hold('GET', readOf(host))
      await press(host.editAsset())
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      const first = held.waiting[0]!
      await closeFromLoader()
      await press(host.editAsset())
      await vi.waitFor(() => expect(held.waiting).toHaveLength(2))
      const second = held.waiting[1]!

      first.release({ status: 500 })
      await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
      await waits.settle()

      expect([detail().dialog, detail().asset, detail().loading]).toEqual([QUEUE, null, true])
      expect(loaderDrawn()).toBe(true)

      second.release()
      await vi.waitFor(() => expect(detail().asset?.id).toBe(host.asset))
      await flushPromises()

      expect([detail().dialog, detail().loading]).toEqual([QUEUE, false])
      expect(heading()).toContain(TITLE)
      expect(shownAlerts()).toEqual(failureSaid)
    })

    // The store of the detail is the page's, and outlives its hosts. A host that went away with its detail open (the
    // user leaves the page: Back of the browser is enough) used to leave its key there, and the next host with that
    // key drew the detail at once, over a page that had not asked for it: in admin-ugc an empty dialog over the list
    // of assets, which only a reload took away.
    it('is closed when its host goes away: a host mounted with the same key afterwards draws none', async () => {
      await host.mount()
      await press(host.editAsset())
      await vi.waitFor(() => expect(detail().asset?.id).toBe(host.asset))
      await flushPromises()
      expect(assetDrawn()).toBe(true)

      page!.unmount()
      page = undefined
      await flushPromises()

      expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
      expect(card()).toBeNull()

      await (host.mountAgain ?? host.mount)()
      await waits.settle()

      expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
      expect(card()).toBeNull()
      expect(reachable(host.editAsset())).toBe(true)
      // The page goes on: "edit asset" opens the detail as it did, with one read of the asset it shows now.
      const before = dam.requests.length
      await press(host.editAsset())
      await vi.waitFor(() => expect(detail().asset?.id).toBe(host.assetAgain ?? host.asset))
      await flushPromises()
      expect(askedSince(before)).toEqual([`GET ${(host.readAgain ?? host.read)()}`])
      expect(heading()).toContain(TITLE)
      expect(shownAlerts()).toEqual([])
    })

    it('gives its read up when its host goes away: the answer that comes after is taken by nothing', async () => {
      await host.mount()
      const extSystemBefore = pageExtSystem().value
      const held = dam.hold('GET', readOf(host))
      await press(host.editAsset())
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      expect(loaderDrawn()).toBe(true)

      page!.unmount()
      page = undefined
      expect([detail().dialog, detail().loading]).toEqual([null, false])
      // The answer names an asset of another licence, of another ext system.
      held.release({ status: 200, data: inTheDam('asset-late', 'The late one', OTHER) })
      await waits.settle()

      expect([detail().dialog, detail().asset, detail().loading]).toEqual([null, null, false])
      expect(card()).toBeNull()
      expect(pageExtSystem().value).toBe(extSystemBefore)
      expect(shownAlerts()).toEqual([])
    })
  })
})

const anAsset = (id: DocId) => damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed)
/** A read the test answers. */
const heldRead = () => {
  let answer!: (answered: AssetDetailItemDto) => void
  let fail!: (reason: Error) => void
  const read = new Promise<AssetDetailItemDto>((resolve, reject) => {
    answer = resolve
    fail = reject
  })
  return { read: () => read, answer, fail }
}

// The store of the detail alone, for what none of the four hosts shows: an asset another part of the page has left in
// the store, a detail opened over the same queue without a read, as the asset list opens the detail of the asset its
// side panel shows, and the read that list makes for its side panel when a detail has closed.
describe('the store of the detail of an asset, opened with a read', () => {
  let store: ReturnType<typeof useAssetDetailStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAssetDetailStore()
  })

  /** The asset list opens the detail of the asset its side panel shows: over its queue, without a read. */
  const openedByTheList = () => {
    store.setAsset(anAsset('asset-of-the-list'))
    store.dialog = QUEUE
  }

  it('starts from an empty store: an asset left there is not shown while the asset of the detail is read', async () => {
    store.setAsset(anAsset('asset-left'))
    const held = heldRead()

    const opened = store.open(QUEUE, held.read)

    expect([store.dialog, store.asset, store.loading]).toEqual([QUEUE, null, true])
    held.answer(anAsset('asset-own'))
    await opened
    expect([store.dialog, store.asset?.id, store.loading]).toEqual([QUEUE, 'asset-own', false])
  })

  // No host opens the detail twice without a close between: its loader covers the page. The store does not count on it.
  it.each<[string, boolean]>([
    ['first', true],
    ['last', false],
  ])(
    'takes the answer of the read it was opened with last, when it is opened again at once and the older answer comes %s',
    async (_when, olderFirst) => {
      const older = heldRead()
      const newer = heldRead()
      const shown = vi.fn()
      const openedBefore = store.open(QUEUE, older.read, shown)
      const openedLast = store.open(QUEUE, newer.read)

      if (olderFirst) {
        older.answer(anAsset('asset-older'))
        await openedBefore
        expect([store.dialog, store.asset, store.loading]).toEqual([QUEUE, null, true])
        newer.answer(anAsset('asset-newer'))
        await openedLast
      } else {
        newer.answer(anAsset('asset-newer'))
        await openedLast
        older.answer(anAsset('asset-older'))
        await openedBefore
      }

      expect([store.dialog, store.asset?.id, store.loading]).toEqual([QUEUE, 'asset-newer', false])
      expect(shown).not.toHaveBeenCalled()
    }
  )

  it('gives its read up when it closes: a detail opened over the same queue meanwhile takes nothing of the answer', async () => {
    const held = heldRead()
    const shown = vi.fn()
    const opened = store.open(QUEUE, held.read, shown)
    store.close()
    openedByTheList()

    held.answer(anAsset('asset-late'))
    await opened

    expect([store.dialog, store.asset?.id, store.loading]).toEqual([QUEUE, 'asset-of-the-list', false])
    expect(shown).not.toHaveBeenCalled()
  })

  it('gives its read up when it closes: a detail opened over the same queue meanwhile is not closed when the read fails', async () => {
    const held = heldRead()
    const opened = store.open(QUEUE, held.read)
    store.close()
    openedByTheList()

    held.fail(new Error('The asset is gone.'))
    // The failure is the host's to say, as that of every read.
    await expect(opened).rejects.toThrow('The asset is gone.')

    expect([store.dialog, store.asset?.id, store.loading]).toEqual([QUEUE, 'asset-of-the-list', false])
  })

  // The asset list reads the asset of its side panel again when a detail has closed. That read is not one a detail
  // was opened with: written whenever it answered, its asset was what a detail opened meanwhile showed and saved.
  describe('a read beside the detail, of the asset a side panel shows', () => {
    it('is taken while no detail is open, and none was opened since it began', async () => {
      const held = heldRead()
      const read = store.readBesideDetail(held.read)

      held.answer(anAsset('asset-of-the-panel'))
      await read

      expect([store.dialog, store.asset?.id, store.loading]).toEqual([null, 'asset-of-the-panel', false])
    })

    it.each<[string, boolean]>([
      ['first', true],
      ['last', false],
    ])(
      'is not taken once a detail was opened with a read of its own, when it answers %s',
      async (_when, besideFirst) => {
        const beside = heldRead()
        const own = heldRead()
        const read = store.readBesideDetail(beside.read)
        const opened = store.open(QUEUE, own.read)

        if (besideFirst) {
          beside.answer(anAsset('asset-of-the-panel'))
          await read
          expect([store.dialog, store.asset, store.loading]).toEqual([QUEUE, null, true])
          own.answer(anAsset('asset-own'))
          await opened
        } else {
          own.answer(anAsset('asset-own'))
          await opened
          beside.answer(anAsset('asset-of-the-panel'))
          await read
        }

        expect([store.dialog, store.asset?.id, store.loading]).toEqual([QUEUE, 'asset-own', false])
      }
    )

    it('is not taken while a detail opened without a read is open', async () => {
      const held = heldRead()
      const read = store.readBesideDetail(held.read)
      openedByTheList()

      held.answer(anAsset('asset-of-the-panel'))
      await read

      expect([store.dialog, store.asset?.id]).toEqual([QUEUE, 'asset-of-the-list'])
    })

    // The close of that detail has its host read again: the older answer is not the news.
    it('is not taken once a detail was opened and closed since, over the read its close began', async () => {
      const older = heldRead()
      const newer = heldRead()
      const readBefore = store.readBesideDetail(older.read)
      openedByTheList()
      store.close()
      const readAfter = store.readBesideDetail(newer.read)

      newer.answer(anAsset('asset-read-after'))
      await readAfter
      older.answer(anAsset('asset-read-before'))
      await readBefore

      expect([store.dialog, store.asset?.id]).toEqual([null, 'asset-read-after'])
    })

    it('fails as its read does, and writes nothing', async () => {
      store.setAsset(anAsset('asset-shown'))
      const held = heldRead()
      const read = store.readBesideDetail(held.read)

      held.fail(new Error('The asset is gone.'))

      await expect(read).rejects.toThrow('The asset is gone.')
      expect(store.asset?.id).toBe('asset-shown')
    })
  })
})

// The dialog of the detail tells its host that the detail has closed: the button of the dialog closes it, and so does
// the store, after a read that failed. It is told once for each closing of the detail of that host, with the asset
// the detail showed when its button closed it. The dialog used to tell at every change of the store's dialog: again,
// with the asset of the close before, when the detail was opened once more before the host had drawn, and at the
// opening of another host's detail. The real dialog under a host that draws it as the widgets do; what it frames is
// not drawn.
describe('the dialog of the detail of an asset, telling its host that the detail closed', () => {
  let store: ReturnType<typeof useAssetDetailStore>
  let host: VueWrapper | undefined
  /** The asset each `close` told of, by its id: `null` for none. */
  let told: Array<DocId | null>

  beforeEach(() => {
    const own = createPinia()
    setActivePinia(own)
    installConsumerProfile(cmsConfiguration, createFakeDam(cmsConfiguration.endPoints).client)
    store = useAssetDetailStore()
    told = []
    const Host = defineComponent({
      setup: () => () =>
        store.dialog === QUEUE
          ? h(AssetDetailDialog, {
              queueKey: QUEUE,
              extSystem: cmsConfiguration.extSystem,
              onClose: (shown: AssetDetailItemDto | null) => told.push(shown?.id ?? null),
            })
          : null,
    })
    host = mount(Host, {
      attachTo: document.body,
      global: { plugins: [own], stubs: { AssetDetailDialogFrame: true } },
    })
  })
  afterEach(() => {
    host?.unmount()
    host = undefined
  })

  /** The detail of the host is open and shows an asset. */
  const shown = async () => {
    await store.open(QUEUE, async () => anAsset('asset-shown'))
    await flushPromises()
  }
  const pressClose = () => host!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')

  it('tells once, with the asset it showed, when its button closes it', async () => {
    await shown()

    pressClose()
    await flushPromises()

    expect(told).toEqual(['asset-shown'])
    expect(store.dialog).toBeNull()
  })

  it('tells once, with no asset, when the store closes it after a read that failed', async () => {
    const held = heldRead()
    const opened = store.open(QUEUE, held.read)
    await flushPromises()

    held.fail(new Error('The asset is gone.'))
    await expect(opened).rejects.toThrow('The asset is gone.')
    await flushPromises()

    expect(told).toEqual([null])
  })

  // Before the host has drawn again, the dialog that has just closed is still there to see the next opening.
  it('does not tell again when the detail is opened once more at once, and forgets the asset of the close before', async () => {
    await shown()

    pressClose()
    const held = heldRead()
    const openedAgain = store.open(QUEUE, held.read)
    expect(told).toEqual(['asset-shown'])
    await flushPromises()
    expect(told).toEqual(['asset-shown'])

    // The detail opened again showed no asset: its read fails, and the store closes it.
    held.fail(new Error('The asset is gone.'))
    await expect(openedAgain).rejects.toThrow('The asset is gone.')
    expect(told).toEqual(['asset-shown', null])
  })

  it('says nothing of the detail another host opens once its own has closed', async () => {
    await shown()

    pressClose()
    void store.open('queue-of-another-host', heldRead().read)
    store.close()
    await flushPromises()

    expect(told).toEqual(['asset-shown'])
  })

  // No host can open its detail over the open detail of another: the loader covers the page. Were it to happen, the
  // detail of this host is gone, and its host is told so once; what it showed is not known by then.
  it('tells once, with no asset, when the detail of another host takes its place, and nothing of what follows', async () => {
    await shown()

    void store.open('queue-of-another-host', heldRead().read)
    store.close()
    void store.open('queue-of-another-host', heldRead().read)
    await flushPromises()

    expect(told).toEqual([null])
  })

  // A host that goes away with its detail open: the store is the page's, and its key would stay there for the next
  // host of that key to draw the detail by. The dialog closes the store as it is taken away, and tells nobody: its
  // host is going away as well.
  it('closes the store, and tells nobody, when it is taken away with its detail open', async () => {
    await shown()

    host!.unmount()
    host = undefined

    expect([store.dialog, store.asset, store.loading]).toEqual([null, null, false])
    expect(told).toEqual([])
  })

  it('gives the read of its detail up when it is taken away while that read is on its way', async () => {
    const held = heldRead()
    const taken = vi.fn()
    const opened = store.open(QUEUE, held.read, taken)
    await flushPromises()

    host!.unmount()
    host = undefined
    held.answer(anAsset('asset-late'))
    await opened

    expect([store.dialog, store.asset, store.loading]).toEqual([null, null, false])
    expect(taken).not.toHaveBeenCalled()
    expect(told).toEqual([])
  })

  // The dialog is taken away by its host as well once its detail has closed, or once the key of another host has
  // taken its place: what is in the store by then is not its own to close.
  it.each<[string, () => void]>([
    ['its own has closed', () => pressClose()],
    ['the key of that host has taken the place of its own', () => undefined],
  ])('leaves the detail of another host open when it is taken away after %s', async (_when, before) => {
    await shown()
    const held = heldRead()

    before()
    const openedByAnother = store.open('queue-of-another-host', held.read)
    const toldBefore = [...told]
    // The host draws again, without the dialog.
    await flushPromises()

    expect(host!.findComponent(AssetDetailDialog).exists()).toBe(false)
    expect([store.dialog, store.loading]).toEqual(['queue-of-another-host', true])
    held.answer(anAsset('asset-of-another-host'))
    await openedByAnother
    expect([store.dialog, store.asset?.id, store.loading]).toEqual([
      'queue-of-another-host',
      'asset-of-another-host',
      false,
    ])
    expect(told).toEqual(toldBefore)
  })
})
