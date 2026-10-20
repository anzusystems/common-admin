import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type ApiErrorLogger, defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAssetWithFile,
  damImageFile,
  damImageLinks,
  type FakeDam,
  type FakeDamAnswer,
} from '@/domains/dam/__tests__/support/fakeDam'
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
import AssetDetailSidebarROI from '@/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue'
import AssetImage from '@/domains/dam/assetDetail/components/AssetImage.vue'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import DamAssetImageRoiSelectLazy from '@/domains/dam/cropper/components/DamAssetImageRoiSelectLazy.vue'
import type { UploadMetadataToImageMapFn } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import UploadQueueDialogSingleSidebar from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebar.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
// Not applied by importing it: the case that needs the style of the library puts it in the page, and takes it out.
import libraryStyle from '@/styles/main.scss?inline'

// The dialog of an image widget for one uploaded file, under each of the two applications: what it consists of
// while the file is on its way and once it is done, who may edit the region of interest in it, and what its "save",
// its "save and apply" and its close button do. The real dialog with its real sidebar over the real queue; the DAM
// is a client that records its requests, and only the long waits are taken out of real time. The refresh the
// dialog comes to offer, and what it says of a duplicate, are in `uploadQueueDialogSingle.test.ts`.

const QUEUE = 'single-dialog'
const { Processing, Uploaded, Failed, Uploading } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined
/** The map of the application from an upload to images, where it brings one: called as the dialog calls it. */
let mapOfTheApplication: Mock<UploadMetadataToImageMapFn> | undefined

const photo = () => new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})

describe.each(consumerProfiles)('the dialog of one uploaded file under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
  const isCms = profile === cmsConfiguration
  const bulkSave = `${endPoints.asset}/metadata-bulk-update`

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    const { coreDam } = installConsumerProfile(profile, dam.client)
    const own = coreDam.configs.default!
    mapOfTheApplication = own.customUploadMetadataToImageMap ? vi.fn(own.customUploadMetadataToImageMap) : undefined
    if (mapOfTheApplication) {
      initCommonAdminCoreDamOptions({
        ...coreDam,
        configs: { default: { ...own, customUploadMetadataToImageMap: mapOfTheApplication } },
      })
    }
    answerDamNames(dam)
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
    // As the widget leaves it when it opens the dialog of its queue.
    useUploadQueueDialog().uploadQueueDialog.value = QUEUE
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    useUploadQueueDialog().uploadQueueDialog.value = null
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const queue = () => useUploadQueuesStore(pinia)
  const item = () => queue().getQueueItems(QUEUE)[0]
  /** With the real picture where a test reads how it is drawn: it asks no server for a file without a preview. */
  const mountDialog = async (realPicture = false) => {
    wrapper = mount(UploadQueueDialogSingle, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        licenceId: licence,
        fileInputKey: 0,
        extSystem,
        accept: undefined,
        maxSizes: undefined,
      },
      global: {
        plugins: [pinia],
        // The picture would ask the image server; the editor of the region of interest is the cropper, and its
        // sidebar asks the DAM for the regions; the inputs of keywords and authors ask it for names to offer.
        stubs: {
          AssetImage: !realPicture,
          DamAssetImageRoiSelectLazy: true,
          AssetDetailSidebarROI: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    await flushPromises()
  }
  /** A file is picked: the widget queues it and opens the dialog of its queue. The row waits for the server. */
  const pickOne = async () => {
    await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
    await mountDialog()
    await vi.waitFor(() => expect(item().status).toBe(Processing))
    await flushPromises()
  }
  /** The server has processed the file, the queue has asked, and the dialog has read the asset for its detail. */
  const uploaded = async (parts: Record<string, unknown> = metadata({ description: 'from the server' })) => {
    await pickOne()
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, parts)
    await waits.elapse()
    await vi.waitFor(() => expect(item().status).toBe(Uploaded))
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1'))
    await flushPromises()
  }
  // The dialog is drawn into the body.
  const inDialog = <T extends Element>(selector: string) =>
    document.body.querySelector<T>(`.dam-image-detail ${selector}`)
  const allInDialog = <T extends Element>(selector: string) =>
    Array.from(document.body.querySelectorAll<T>(`.dam-image-detail ${selector}`))
  const toolbar = () => inDialog<HTMLElement>('.v-toolbar')!
  const leftPane = () => inDialog<HTMLElement>('.dam-image-detail__left')!
  const sidebar = () => inDialog<HTMLElement>('.dam-image-detail__sidebar')!
  const tab = (name: 'button-meta' | 'button-focus') => inDialog<HTMLElement>(`[data-cy="${name}"]`)
  const button = (name: 'button-save' | 'button-save-and-apply' | 'button-close') =>
    inDialog<HTMLButtonElement>(`[data-cy="${name}"]`)!
  const roiEditor = () => wrapper!.findComponent(DamAssetImageRoiSelectLazy)
  const labels = () =>
    allInDialog<HTMLElement>('.v-field .v-label, .v-switch .v-label').map((label) => label.textContent?.trim())
  // The fields the user types into; a growing text field has a hidden twin that measures it.
  const fields = () =>
    allInDialog<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea').filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  const type = async (field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    field.value = text
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
  }
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  const updated = ['success', alertText('common.alert.recordWas.updated')]
  const fixTheForm = ['error', alertText('common.alert.fixValidationErrors')]
  const systemError = ['error', alertText('common.alert.unknownError')]
  /** The one alert of a refusal by validation: its heading, and the field each of its lines names. */
  const refusalSaid = () => {
    expect(shownAlerts()).toHaveLength(1)
    const [[colour, text]] = shownAlerts() as Array<[string, string]>
    const [heading, ...lines] = text.split('\n')

    return { colour, heading, fields: lines.map((line) => line.split(': ')[0]) }
  }
  /** The DAM answers every save of metadata so. */
  const refuseSaves = (answer: FakeDamAnswer) =>
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? answer : undefined
    )
  const outsideOwnPrefix = () =>
    dam.requests.filter((request) => request.url.startsWith(foreignPrefix) && !/\/(author|keyword)\//.test(request.url))

  describe('while the server works on the file', () => {
    it('says the upload runs, has the metadata tab alone, and can be neither filled nor saved', async () => {
      await pickOne()

      expect(toolbar().textContent).toContain(damText('upload.title'))
      expect(toolbar().textContent).not.toContain(damText('upload.titleDone'))
      // Also an application that asks for a sidebar without tabs has them until the file is done.
      expect([!!tab('button-meta'), !!tab('button-focus')]).toEqual([true, false])
      expect(roiEditor().exists()).toBe(false)
      expect(leftPane().querySelector('asset-image-stub')).not.toBeNull()
      expect(fields().length).toBe(2)
      expect(fields().every((field) => field.disabled)).toBe(true)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([true, true])
      // The dialog has read no asset for its detail yet.
      expect(useAssetDetailStore(pinia).asset).toBeNull()
    })
  })

  // Over the picture, in the ratio of 16 to 9, the dialog shows how far the upload is, as its row has it. The picture
  // is the preview of the row once it has one, in the size the preview was asked for (not the size it came out in),
  // on the dominant colour of the main file; until then a grey box of 356 by 200, of the kind and the state of the row.
  describe('the picture of the file', () => {
    const COLOUR = '#3a6b8c'
    const drawn = () => wrapper!.findComponent(AssetImage)
    const shows = () => {
      const { showUploading, showProcessing, showWaiting, showDone, aspectRatio } = drawn().props()

      return { showUploading, showProcessing, showWaiting, showDone, aspectRatio }
    }
    const states = (uploading: boolean, processing: boolean, done: boolean) => ({
      showUploading: uploading,
      showProcessing: processing,
      showWaiting: false,
      showDone: done,
      aspectRatio: 16 / 9,
    })
    /** The picture of a row without a preview yet: of the type and the state of the row. */
    const greyBox = () => ({
      src: '',
      width: 356,
      height: 200,
      backgroundColor: '#ccc',
      assetType: item().assetType,
      assetStatus: item().assetStatus,
    })

    it('shows the file being sent, then processed, then done, and then its preview', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      await mountDialog()
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      await flushPromises()
      expect(item().status).toBe(Uploading)
      // How far the chunk is, as the store writes it from the progress the client reports; the fake DAM reports none.
      item().progress.progressPercent = 37.5
      item().progress.remainingTime = 12
      await flushPromises()
      expect(shows()).toEqual(states(true, false, false))
      expect(drawn().props()).toMatchObject({ uploadingProgress: 37.5, remainingTime: 12, ...greyBox() })

      chunks.release()
      await vi.waitFor(() => expect(item().status).toBe(Processing))
      await flushPromises()
      expect(shows()).toEqual(states(false, true, false))
      expect(drawn().props()).toMatchObject(greyBox())

      const file = item().fileId!
      const links = damImageLinks(file)
      // The preview was asked for in another size than it came out in.
      Object.assign(links, { image_detail: { ...links.image_detail!, requestedWidth: 1280, requestedHeight: 720 } })
      dam.fileBecomes(item().assetId!, AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }), {
        links,
        imageAttributes: {
          ...damImageFile(file, item().assetId!, AssetFileProcessStatus.Processed).imageAttributes,
          mostDominantColor: COLOUR,
        },
      })
      await waits.elapse()
      await vi.waitFor(() => expect(item().status).toBe(Uploaded))
      await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe(item().assetId))
      await flushPromises()
      // admin-ugc has the editor of the region of interest in place of the picture once the file is done.
      expect(drawn().exists()).toBe(isCms)
      if (!isCms) return
      expect(shows()).toEqual(states(false, false, true))
      expect(drawn().props()).toMatchObject({
        src: links.image_detail!.url,
        width: 1280,
        height: 720,
        backgroundColor: COLOUR,
        assetType: DamAssetType.Image,
        assetStatus: DamAssetStatus.WithFile,
      })
    })

    // A row of another kind and in another state than the defaults of the picture: the grey box says what the row is.
    it('draws the grey box of the kind and the state of its row', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      await mountDialog()
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      item().assetType = DamAssetType.Video
      item().assetStatus = DamAssetStatus.Deleting
      await flushPromises()

      expect(drawn().props()).toMatchObject({
        ...greyBox(),
        assetType: DamAssetType.Video,
        assetStatus: DamAssetStatus.Deleting,
      })
    })

    // The overlay of the error is laid out in the positioned box of the picture (design 2.8): the box holds the
    // picture and then the overlay, so the overlay is drawn over it. How large the box is, is not pinned: the
    // owner has U6 give it a size (finding 64).
    it('draws the error of a refused file in the positioned box of the picture, after the picture', async () => {
      await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      await mountDialog(true)
      await vi.waitFor(() => expect(item().status).toBe(Processing))
      dam.fileBecomes(
        item().assetId!,
        AssetFileProcessStatus.Failed,
        {},
        { failReason: AssetFileFailReason.InvalidMimeType }
      )
      await waits.elapse()
      await vi.waitFor(() => expect(item().status).toBe(Failed))
      await flushPromises()

      const picture = leftPane().querySelector<HTMLElement>('.asset-image')!
      const overlay = leftPane().querySelector<HTMLElement>('.dam-upload-queue__overlay')!
      const box = picture.parentElement!
      expect(overlay.offsetParent).toBe(box)
      expect([...box.children]).toEqual([picture, overlay])
      expect(shows()).toEqual(states(false, false, false))
    })

    // Finding 64: under the style of the library the box has the area of the left side, as the picture of the detail
    // has: the grey placeholder of a refused file fills it, and the overlay covers it. Without a size of its own the box
    // was 0 by 0, and so were the placeholder and the overlay: the icon and the texts of the error stood over nothing.
    it('gives the grey placeholder of a refused file and its overlay the area of the picture, under the style of the library', async () => {
      const style = document.createElement('style')
      style.textContent = libraryStyle
      document.head.append(style)
      try {
        await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
        await mountDialog(true)
        await vi.waitFor(() => expect(item().status).toBe(Processing))
        dam.fileBecomes(
          item().assetId!,
          AssetFileProcessStatus.Failed,
          {},
          { failReason: AssetFileFailReason.InvalidMimeType }
        )
        await waits.elapse()
        await vi.waitFor(() => expect(item().status).toBe(Failed))
        await flushPromises()

        const picture = leftPane().querySelector<HTMLElement>('.asset-image')!
        const area = (element: Element) => {
          const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
          return { left, top, right, bottom, width, height }
        }
        const box = area(picture.parentElement!)
        const drawn = area(picture)
        const covering = area(leftPane().querySelector('.dam-upload-queue__overlay')!)
        expect(picture.classList.contains('asset-image--placeholder')).toBe(true)
        expect([box, drawn, covering].map(({ width, height }) => width > 0 && height > 0)).toEqual([true, true, true])
        expect([
          covering.left <= drawn.left,
          covering.top <= drawn.top,
          covering.right >= drawn.right,
          covering.bottom >= drawn.bottom,
        ]).toEqual([true, true, true, true])
      } finally {
        style.remove()
      }
    })

    // Only the placeholder takes the area: the preview of an uploaded file keeps the size it was asked in, as before U6,
    // and is cut off where the area is smaller, not shrunk to it; the veil of "done" covers the preview, not the area.
    it('draws the preview of an uploaded file in the size it was asked in, under the style of the library', async () => {
      const style = document.createElement('style')
      style.textContent = libraryStyle
      document.head.append(style)
      try {
        await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
        await mountDialog(true)
        await vi.waitFor(() => expect(item().status).toBe(Processing))
        // A preview asked for in a size other than the one it came out in, and taller than the area.
        const links = damImageLinks(item().fileId!)
        Object.assign(links, { image_detail: { ...links.image_detail!, requestedWidth: 1280, requestedHeight: 1600 } })
        dam.fileBecomes(
          item().assetId!,
          AssetFileProcessStatus.Processed,
          metadata({ description: 'from the server' }),
          {
            links,
          }
        )
        await waits.elapse()
        await vi.waitFor(() => expect(item().status).toBe(Uploaded))
        await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe(item().assetId))
        await flushPromises()
        // admin-ugc has the editor of the region of interest in place of the picture once the file is done.
        expect(leftPane().querySelector('.asset-image') !== null).toBe(isCms)
        if (!isCms) return

        const { requestedWidth, requestedHeight } = item().imagePreview!
        // An area lower than the preview, whatever the height of the window the test runs in.
        leftPane().style.height = '400px'
        await flushPromises()
        expect(leftPane().getBoundingClientRect().height).toBeLessThan(requestedHeight!)
        const picture = leftPane().querySelector<HTMLElement>('.asset-image')!
        const { width, height } = picture.getBoundingClientRect()
        expect(picture.classList.contains('asset-image--placeholder')).toBe(false)
        expect([width, height]).toEqual([requestedWidth, requestedHeight])
        expect(picture.parentElement!.getBoundingClientRect().width).toBe(requestedWidth)
      } finally {
        style.remove()
      }
    })
  })

  describe('once the file is uploaded', () => {
    it('reads the asset from the DAM of the application for its detail, says the upload is done and opens the form', async () => {
      await uploaded()

      expect(dam.sentTo('GET', dam.routes.one).map((request) => request.url)).toContain(`${endPoints.asset}/asset-1`)
      expect(outsideOwnPrefix()).toEqual([])
      expect(dam.unanswered).toEqual([])
      expect(toolbar().textContent).toContain(damText('upload.titleDone'))
      expect(fields().map((field) => field.value)).toContain('from the server')
      expect(fields().some((field) => field.disabled)).toBe(false)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([false, false])
    })

    // admin-cms: the sidebar of the DAM, with its two tabs. admin-ugc asks for the simple one: no tabs, the editor of
    // the region of interest in place of the picture at once, and its regions under the form.
    it('lays out the region of interest as the application asks: behind a tab of its own, or in place of the picture', async () => {
      await uploaded()

      expect([!!tab('button-meta'), !!tab('button-focus')]).toEqual(isCms ? [true, true] : [false, false])
      expect(sidebar().querySelector('.sidebar-info--no-tabs') !== null).toBe(!isCms)
      expect(roiEditor().exists()).toBe(!isCms)
      expect(leftPane().querySelector('asset-image-stub') !== null).toBe(isCms)
      expect(wrapper!.findComponent(AssetDetailSidebarROI).exists()).toBe(!isCms)
      if (!isCms) {
        expect(wrapper!.findComponent(AssetDetailSidebarROI).props()).toMatchObject({ isActive: true, queueKey: QUEUE })
        return
      }
      // The tab of the region of interest puts its editor in place of the picture, and its regions in place of the
      // form; the buttons of the form go with the form.
      tab('button-focus')!.click()
      await vi.waitFor(() => expect(roiEditor().exists()).toBe(true))
      expect(leftPane().querySelector('asset-image-stub')).toBeNull()
      expect(wrapper!.findComponent(AssetDetailSidebarROI).props()).toMatchObject({ isActive: true, queueKey: QUEUE })
      expect(fields()).toEqual([])
      expect(inDialog('[data-cy="button-save-and-apply"]')).toBeNull()
      expect(useAssetDetailStore(pinia).activeTab).toBe(AssetDetailTabImageWithRoi.ROI)
    })

    // admin-cms: its two custom fields, the keywords and authors of the DAM, the single-use switch, and what the
    // DAM knows of the file. admin-ugc: its two custom fields and nothing else.
    it('has the fields of the application: its custom fields, and keywords, authors, the switch and the file panel only where it has them', async () => {
      await uploaded()

      expect(new Set(labels())).toEqual(
        new Set(isCms ? ['title', 'description', damText('asset.model.mainFileSingleUse')] : ['description', 'author'])
      )
      expect(fields()).toHaveLength(2)
      expect(wrapper!.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(isCms)
      expect(wrapper!.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(isCms)
      expect(inDialog('.v-switch') !== null).toBe(isCms)
      const panels = allInDialog<HTMLElement>('.v-expansion-panel-title').map((title) => title.textContent?.trim())
      expect(panels).toEqual(
        isCms
          ? [damText('asset.detail.info.metadata'), damText('asset.detail.info.file')]
          : [damText('asset.detail.info.metadata')]
      )
      // The file panel names the asset and its file.
      expect(sidebar().textContent!.includes('file-1')).toBe(isCms)
    })

    // The card breaks a long word anywhere, and the panel of the file of this dialog keeps that; the detail of an
    // asset breaks its own only between words (design 1.10, JS29).
    if (isCms) {
      it('breaks the texts of the panel of the file as the rest of its card does', async () => {
        await uploaded()

        const filePanel = allInDialog<HTMLElement>('.v-expansion-panel').find(
          (panel) =>
            panel.querySelector('.v-expansion-panel-title')?.textContent?.trim() === damText('asset.detail.info.file')
        )!
        expect(getComputedStyle(filePanel.querySelector('.v-expansion-panel-text__wrapper')!).overflowWrap).toBe(
          'break-word'
        )
      })
    }
  })

  // The store of the detail is shared with the widgets: an asset picked in the library is left in it, where the
  // dialog of the image reads its authors. The dialog of the file uploaded next showed that asset as its own: its
  // "file info" while the file was on its way, and the whole of it once the file was done, until its own was read.
  describe('over a detail store that holds an asset left by a pick from the library', () => {
    it('shows the row alone until it has read the asset of its file, and that asset from then on', async () => {
      useAssetDetailStore(pinia).setAsset(
        damAssetWithFile('asset-picked', 'file-picked', AssetFileProcessStatus.Processed, {
          licence,
          ...metadata({ description: 'of the picked asset' }),
        })
      )
      // The read of the dialog, asked once the row is uploaded; those of the queue come before that.
      const readsOfTheDialog: Array<() => void> = []
      dam.reply((request) =>
        request.method === 'GET' && dam.routes.one.test(request.url) && item()?.status === Uploaded
          ? new Promise<undefined>((resolve) => readsOfTheDialog.push(() => resolve(undefined)))
          : undefined
      )
      const shown = () => {
        const { assetId, assetMainFileStatus } = wrapper!.findComponent(UploadQueueDialogSingleSidebar).props()
        return { assetId, assetMainFileStatus, fileInfoOfTheOther: sidebar().textContent!.includes('file-picked') }
      }
      const theRowAlone = { assetId: 'asset-1', assetMainFileStatus: undefined, fileInfoOfTheOther: false }

      await pickOne()
      expect(shown()).toEqual(theRowAlone)

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
      await waits.elapse()
      await vi.waitFor(() => expect(readsOfTheDialog).toHaveLength(1))
      await flushPromises()
      expect(item().status).toBe(Uploaded)
      expect(shown()).toEqual(theRowAlone)

      readsOfTheDialog[0]()
      await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1'))
      await flushPromises()
      expect(shown()).toEqual({
        assetId: 'asset-1',
        assetMainFileStatus: AssetFileProcessStatus.Processed,
        fileInfoOfTheOther: false,
      })
      // admin-cms shows what the DAM knows of the file, now of this one.
      expect(sidebar().textContent!.includes('file-1')).toBe(isCms)
    })
  })

  describe('the editor of the region of interest', () => {
    const shown = async () => {
      await uploaded()
      if (isCms) {
        tab('button-focus')!.click()
        await vi.waitFor(() => expect(roiEditor().exists()).toBe(true))
      }
      return roiEditor()
    }

    if (isCms) {
      // The endpoint of admin-cms saves a region only for a user with the grant; without it the tab shows the image.
      it.each([
        [
          'can be edited by a user of the DAM who may update regions of interest',
          ['dam_regionOfInterest_update'],
          false,
        ],
        ['only shows the image to a user of the DAM without that grant', ['dam_image_update'], true],
      ])('%s', async (_what, grants, readonly) => {
        signInToDam(extSystem, grants)

        expect((await shown()).props('readonly')).toBe(readonly)
      })

      it('only shows the image while no user of the DAM is loaded', async () => {
        expect((await shown()).props('readonly')).toBe(true)
      })
    } else {
      // The endpoint of admin-ugc asks for no grant, and the application has no user of the DAM to ask one of.
      it('can be edited with no user of the DAM at all', async () => {
        expect((await shown()).props('readonly')).toBe(false)
      })
    }

    it('is handed the ext system of the upload', async () => {
      expect((await shown()).props('extSystem')).toBe(extSystem)
    })
  })

  describe('"save and apply"', () => {
    /** The uploaded file of an editor who has typed a description; in admin-cms its asset has two authors. */
    const typedIn = async () => {
      await uploaded({
        ...metadata({ description: 'from the server', author: ' A. Author ' }),
        authors: isCms ? ['author-1', 'author-2'] : [],
      })
      await damNamesAsked()
      await type(
        fields().find((field) => field.value === 'from the server')!,
        ' typed by the user '
      )
    }

    it('saves the metadata, hands the widget one image built from the answer, then empties the queue and closes the dialog', async () => {
      // The DAM answers a save with the asset as it is then, internal or not.
      dam.reply((request) =>
        request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)
          ? {
              status: 200,
              data: (dam.body(request) as Array<Record<string, unknown>>).map((sent) => ({
                ...sent,
                mainFileInternal: true,
              })),
            }
          : undefined
      )
      await typedIn()
      const lookupsBefore = damNameLookups(dam).length

      button('button-save-and-apply').click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))
      await flushPromises()

      expect(saves().map((request) => request.url)).toEqual([bulkSave])
      const sent = dam.body(saves()[0]) as Array<Record<string, unknown>>
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        id: 'asset-1',
        keywords: [],
        authors: isCms ? ['author-1', 'author-2'] : [],
        described: true,
        customData: { description: ' typed by the user ', author: ' A. Author ' },
        // A row that has no word of the DAM on it is sent as not single-use.
        mainFileSingleUse: false,
      })
      expect(wrapper!.emitted('apply')![0]).toMatchObject([
        [
          {
            assetId: 'asset-1',
            texts: {
              description: 'typed by the user',
              source: isCms ? 'Name of author-1, Name of author-2' : 'A. Author',
            },
            dam: { damId: 'file-1', licenceId: licence, regionPosition: 0, internal: isCms },
            flags: { showSource: true, internal: false, overrideInternal: false },
            position: 1,
          },
        ],
      ])
      // The library's map asks for the names of the authors, once; the map of admin-ugc asks for nothing.
      expect(damNameLookups(dam).length - lookupsBefore).toBe(isCms ? 1 : 0)
      expect(outsideOwnPrefix()).toEqual([])
      expect(shownAlerts()).toEqual([updated])
      // Unlike the dialog of a queue of files, this one ends the upload itself.
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(useAssetDetailStore(pinia).asset).toBeNull()
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
    })

    it('goes through the map of the application where it brings one: the row, the answer of the save, the client, the ext system and the licence', async () => {
      await typedIn()

      button('button-save-and-apply').click()
      await vi.waitFor(() => expect(wrapper!.emitted('apply')).toHaveLength(1))

      if (!mapOfTheApplication) {
        // admin-cms brings none: the library's own map made the image.
        expect(isCms).toBe(true)
        return
      }
      expect(mapOfTheApplication).toHaveBeenCalledTimes(1)
      const [rowsHanded, answer, client, extSystemHanded, licenceHanded] = mapOfTheApplication.mock.calls[0]
      expect(rowsHanded.map((row) => [row.assetId, row.fileId])).toEqual([['asset-1', 'file-1']])
      expect(answer.map((saved) => [saved.id, saved.customData])).toEqual([
        ['asset-1', { description: ' typed by the user ', author: ' A. Author ' }],
      ])
      expect(client).toBe(dam.client)
      expect([extSystemHanded, licenceHanded]).toEqual([extSystem, licence])
    })

    it('sends nothing, and says what to fix, while a field the application requires is empty', async () => {
      const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
      elements.find((element) => element.property === 'description')!.attributes.required = true
      await uploaded(metadata({}))

      button('button-save-and-apply').click()
      await flushPromises()
      button('button-save').click()
      await flushPromises()

      expect(shownAlerts()).toEqual([fixTheForm, fixTheForm])
      expect(saves()).toEqual([])
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(item().status).toBe(Uploaded)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    it.each([
      ['refuses the save', { status: 500 }],
      ['answers the save with no asset', { status: 200, data: [] }],
    ])('hands over nothing, keeps the dialog and says the save failed when the DAM %s', async (_what, answer) => {
      refuseSaves(answer)
      await typedIn()

      button('button-save-and-apply').click()
      await vi.waitFor(() => expect(saves()).toHaveLength(1))
      await waits.settle()

      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(shownAlerts()).toEqual([systemError])
      expect(item().status).toBe(Uploaded)
      expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1')
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    // admin-ugc brings its own map. What it throws after the save is not the save's to say: the save has said it
    // succeeded, and the map's error of its own is said as it was before, which is not at all.
    if (!isCms) {
      it('says only that the save succeeded when the map of the application fails after it', async () => {
        await typedIn()
        mapOfTheApplication!.mockRejectedValue(new Error('the map of the application failed'))

        button('button-save-and-apply').click()
        await vi.waitFor(() => expect(mapOfTheApplication).toHaveBeenCalledTimes(1))
        await waits.settle()

        expect(saves()).toHaveLength(1)
        expect(shownAlerts()).toEqual([updated])
        expect(wrapper!.emitted('apply')).toBeUndefined()
        expect(item().status).toBe(Uploaded)
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      })
    }
  })

  describe('"save"', () => {
    it('saves the metadata and says so, and leaves the dialog and its queue as they are', async () => {
      await uploaded()
      await type(
        fields().find((field) => field.value === 'from the server')!,
        'typed by the user'
      )

      button('button-save').click()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

      expect(saves().map((request) => request.url)).toEqual([bulkSave])
      expect(dam.body(saves()[0])).toMatchObject([
        { id: 'asset-1', described: true, customData: { description: 'typed by the user' } },
      ])
      expect(wrapper!.emitted('apply')).toBeUndefined()
      expect(item().status).toBe(Uploaded)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    it('keeps the dialog and says the save failed when the DAM refuses it', async () => {
      refuseSaves({ status: 500 })
      await uploaded()

      button('button-save').click()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([systemError]))

      expect(saves()).toHaveLength(1)
      expect(item().status).toBe(Uploaded)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([false, false])
    })

    it('says the user may not, when the DAM forbids the save', async () => {
      refuseSaves({ status: 403 })
      await uploaded()

      button('button-save').click()

      await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.forbiddenError')]]))
    })

    it.each([
      ['a custom field by the name its form gives it', '[0].customData.description', 'Description of the image'],
      ['the keywords by theirs', '[0].keywords', alertText('common.damImage.asset.model.keywords')],
    ])('names a field the DAM refuses as the form does: %s', async (_what, key, name) => {
      const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
      elements.find((element) => element.property === 'description')!.name = 'Description of the image'
      refuseSaves({
        status: 422,
        data: { contextId: 'context', error: 'validation_failed', fields: { [key]: ['error_field_empty'] } },
      })
      await uploaded()

      button('button-save').click()
      await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
      await flushPromises()

      expect(refusalSaid()).toEqual({
        colour: 'error',
        heading: alertText('common.alert.fixApiValidationErrors'),
        fields: [name],
      })
    })

    // As the dialog of a queue of files: the button that saves spins, the other one waits, and a second press
    // sends nothing more.
    it.each([
      ['button-save', 'button-save-and-apply'],
      ['button-save-and-apply', 'button-save'],
    ] as const)(
      '%s spins while the save runs, and sends one request however often it is pressed',
      async (pressed, other) => {
        const held = dam.hold('PATCH', dam.routes.bulkMetadata)
        await uploaded()

        button(pressed).click()
        button(pressed).click()
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        await flushPromises()

        expect(button(pressed).classList.contains('v-btn--loading')).toBe(true)
        expect(button(other).disabled).toBe(true)
        button(other).click()
        await flushPromises()
        expect(saves()).toHaveLength(1)

        held.release()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))
        expect(saves()).toHaveLength(1)
      }
    )
  })

  describe('a file the server refuses', () => {
    it('is said over the picture, with the reason, and can be neither filled nor saved', async () => {
      await pickOne()
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Failed, {}, { failReason: AssetFileFailReason.InvalidMimeType })
      await waits.elapse()
      await vi.waitFor(() => expect(item().status).toBe(Failed))
      await flushPromises()

      const error = leftPane().querySelector<HTMLElement>('.dam-upload-queue__overlay--error')!
      expect(error.textContent).toContain(damText('queueItem.error'))
      expect(error.textContent).toContain(damText('asset.assetFileFailReason.invalidMimeType'))
      // A failed file counts as done, as in the queue of several files.
      expect(toolbar().textContent).toContain(damText('upload.titleDone'))
      expect(fields().every((field) => field.disabled)).toBe(true)
      expect([button('button-save').disabled, button('button-save-and-apply').disabled]).toEqual([true, true])
      // No asset is read for a detail, and the region of interest is not offered.
      expect(useAssetDetailStore(pinia).asset).toBeNull()
      expect(tab('button-focus')).toBeNull()
      expect(roiEditor().exists()).toBe(false)
    })
  })

  describe('the button that closes it', () => {
    const question = () => document.body.querySelector<HTMLElement>('[data-cy="delete-panel"]')

    it('asks first while the file is being sent; confirmed, it stops the upload, empties the queue and closes the dialog', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await queue().addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
      await mountDialog()
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      await flushPromises()
      const signal = chunks.waiting[0]!.request.config.signal as AbortSignal
      const fileInputKey = queue().getQueue(QUEUE)!.fileInputKey

      button('button-close').click()
      await flushPromises()
      expect(question()!.textContent).toContain(damText('upload.stopConfirmQuestion'))
      expect([item().status, signal.aborted]).toEqual([Uploading, false])

      question()!.querySelector<HTMLElement>('[data-cy="button-confirm"]')!.click()
      await flushPromises()

      expect(signal.aborted).toBe(true)
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(queue().getQueue(QUEUE)!.fileInputKey).toBeGreaterThan(fileInputKey)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      // Nothing more is sent, finished or asked about, however long the page stays open.
      await waits.elapseAll()
      expect(dam.sentTo('PATCH', dam.routes.finish)).toEqual([])
      expect(dam.assetReads()).toEqual([])
    })

    it('closes at once a dialog whose file is done: the row and the detail are dropped, saved or not', async () => {
      await uploaded()

      button('button-close').click()
      await flushPromises()

      expect(question()).toBeNull()
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(useAssetDetailStore(pinia).asset).toBeNull()
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(saves()).toEqual([])
      expect(wrapper!.emitted('apply')).toBeUndefined()
    })

    // The dialog reads the asset for its detail once the file is done, and can be closed before the answer. The
    // store of the detail is shared: written by a dialog that is gone, the asset of its file would be the "file
    // info" the dialog of the next file shows.
    it('leaves the detail alone when the asset it asked for comes after it was closed, also under the next dialog', async () => {
      // The read of the dialog, asked once the row is uploaded; those of the queue come before that.
      const readsOfTheDialog: Array<() => void> = []
      dam.reply((request) =>
        request.method === 'GET' && dam.routes.one.test(request.url) && item()?.status === Uploaded
          ? new Promise<undefined>((resolve) => readsOfTheDialog.push(() => resolve(undefined)))
          : undefined
      )
      await pickOne()
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
      await waits.elapse()
      await vi.waitFor(() => expect(readsOfTheDialog).toHaveLength(1))
      const detail = useAssetDetailStore(pinia)
      expect(detail.asset).toBeNull()

      button('button-close').click()
      await flushPromises()
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      // As the widget does with the dialog of a queue that is closed, and with the next file picked.
      wrapper!.unmount()
      useUploadQueueDialog().uploadQueueDialog.value = QUEUE
      await pickOne()
      expect(item().assetId).toBe('asset-2')

      readsOfTheDialog[0]()
      await waits.settle()

      expect(dam.sentTo('GET', dam.routes.one).map((request) => request.url)).toContain(`${endPoints.asset}/asset-1`)
      // admin-cms shows what the DAM knows of the file as soon as the detail has an asset.
      expect(sidebar().textContent).not.toContain('file-1')
      expect(detail.asset).toBeNull()
    })

    // The same read, failing. Said while the dialog is open, as before; after it was closed the error used to be
    // shown all the same, an alert that stays until it is closed, about a dialog the user no longer sees. The
    // failure goes to the api error logger either way.
    describe('when the read of the asset for its detail fails', () => {
      const logged = vi.fn<ApiErrorLogger>()

      beforeEach(() => {
        logged.mockClear()
        setApiErrorLogger(logged)
      })
      afterEach(() => {
        setApiErrorLogger(defaultApiErrorLogger)
      })

      /** The file is done and the dialog has asked for its asset: the DAM answers when the test says. */
      const readOfTheDialogOnItsWay = async () => {
        const fail: Array<() => void> = []
        dam.reply((request) =>
          request.method === 'GET' && dam.routes.one.test(request.url) && item()?.status === Uploaded
            ? new Promise<FakeDamAnswer>((resolve) => fail.push(() => resolve({ status: 500 })))
            : undefined
        )
        await pickOne()
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, metadata({ description: 'from the server' }))
        await waits.elapse()
        await vi.waitFor(() => expect(fail).toHaveLength(1))
        return fail[0]!
      }
      const failureLogged = () => {
        expect(logged).toHaveBeenCalledTimes(1)
        expect(logged.mock.calls[0]![1]).toMatchObject({ entity: 'asset', status: 500 })
        expect(logged.mock.calls[0]![1].url).toContain(`${endPoints.asset}/asset-1`)
      }

      it('says so while the dialog is open', async () => {
        const fail = await readOfTheDialogOnItsWay()

        fail()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([systemError]))
        await waits.settle()

        expect(shownAlerts()).toEqual([systemError])
        expect(useAssetDetailStore(pinia).asset).toBeNull()
        failureLogged()
      })

      it('says nothing once the dialog was closed', async () => {
        const fail = await readOfTheDialogOnItsWay()
        button('button-close').click()
        await flushPromises()
        expect(queue().getQueueItems(QUEUE)).toEqual([])
        // As the widget does with the dialog of a queue that is closed.
        wrapper!.unmount()
        wrapper = undefined

        fail()
        await vi.waitFor(() => expect(logged).toHaveBeenCalled())
        await waits.settle()

        expect(shownAlerts()).toEqual([])
        expect(useAssetDetailStore(pinia).asset).toBeNull()
        failureLogged()
      })
    })
  })

  // What a widget is left with when the file picked is of a type its ext system does not take: the dialog is
  // opened all the same, over a queue that got no row.
  describe('over a queue without a row', () => {
    it('shows a loader alone, whose close button closes the dialog', async () => {
      await mountDialog()

      expect(document.body.querySelector('.dam-image-detail .v-progress-circular')).not.toBeNull()
      expect(inDialog('.dam-image-detail__sidebar')).toBeNull()
      expect(inDialog('[data-cy="button-save-and-apply"]')).toBeNull()

      document.body
        .querySelector<HTMLElement>(`.dam-image-detail button[aria-label="${uiText('common.button.close')}"]`)!
        .click()
      await flushPromises()

      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(dam.requests).toEqual([])
    })
  })
})
