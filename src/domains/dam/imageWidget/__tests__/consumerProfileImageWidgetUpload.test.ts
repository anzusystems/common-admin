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
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
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
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// An upload into the widget of one image, from the file the user picks to the image the widget saves, under each
// of the two applications. The real widget with its real file input, its real upload dialog and its real dialog
// of the image over the real queue; the DAM and the backend of the images are clients that record their requests,
// and only the long waits are taken out of real time. Not mounted for real: the asset picker (it has cases of its
// own), the pictures (they would ask the image server), the editor of the region of interest (the cropper) with
// its sidebar, the asset detail, and the inputs that ask the DAM for names to offer.

const QUEUE = 'lead-image'
const { Processing, Uploaded, Uploading } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let socket: DamSocket
let mounted: VueWrapper[] = []

const photo = (name = 'photo.jpg', type = 'image/jpeg') => new File([new Uint8Array(3000)], name, { type })
const metadata = (customData: Record<string, unknown>) => ({
  metadata: { customData, authorSuggestions: {}, keywordSuggestions: {} },
})
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
/** The id of the image the widget holds: what its form reads. */
const modelValueOf = (widget: VueWrapper) => (widget.props() as { modelValue: number | null }).modelValue
const carrying = (files: File[]) => {
  const dataTransfer = new DataTransfer()
  files.forEach((file) => dataTransfer.items.add(file))
  return dataTransfer
}

describe.each(consumerProfiles)('an upload into the image widget under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const isCms = profile === cmsConfiguration
  /** The image of the file the upload made, at the size the application's widgets show images in. */
  const pictureOf = (file: string) => `https://image.test/image/w500-h281/${file}.jpg`

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
    // admin-cms has its user of the DAM by the time a widget mounts; admin-ugc has none.
    if (isCms) signInToDam(extSystem)
  })
  afterEach(() => {
    mounted.forEach((wrapper) => wrapper.unmount())
    mounted = []
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
  /** The inner widget, with the upload configuration its parent provides: the way admin-ugc mounts it itself. */
  const mountWidget = async (props: Record<string, unknown> = {}, component: Component = ImageWidgetInner) => {
    const widget: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        ...(component === ImageWidgetInner
          ? {
              modelValue: null,
              'onUpdate:modelValue': (value: number | null) => widget.setProps({ modelValue: value }),
            }
          : {
              image: null,
              media: null,
              'onUpdate:image': (value: number | null) => widget.setProps({ image: value }),
              'onUpdate:media': (value: unknown) => widget.setProps({ media: value }),
            }),
        skipCurrentUserCheck: !isCms,
        ...props,
      } as never,
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
        stubs: {
          AAssetSelect: Picker,
          AAssetSelectMedia: Picker,
          AssetDetailDialog: true,
          VImg: true,
          AssetImage: true,
          AImageWidgetSimple: true,
          DamAssetImageRoiSelectLazy: true,
          AssetDetailSidebarROI: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    mounted.push(widget)
    await flushPromises()
    return widget
  }
  // Menus and dialogs are drawn into the body.
  const openMenuItem = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-menu.v-overlay--active .v-list-item'))
  const fileInputOfDialog = () =>
    document.body.querySelector<HTMLInputElement>('[data-cy="create-panel"] input[type="file"]')
  /** The user picks files with "Upload image" of the widget's menu. */
  const pickThroughMenu = async (widget: VueWrapper, files: File[]) => {
    await widget.find(`button[aria-label="${damText('image.button.options')}"]`).trigger('click')
    await vi.waitFor(() => expect(openMenuItem().length).toBeGreaterThan(0))
    openMenuItem()
      .find((entry) => entry.textContent?.trim() === damText('image.button.upload'))!
      .click()
    await vi.waitFor(() => expect(fileInputOfDialog()).not.toBeNull())
    const input = fileInputOfDialog()!
    input.files = carrying(files).files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  }
  const uploadDialog = () => document.body.querySelector<HTMLElement>('.dam-image-detail')
  const inUploadDialog = <T extends Element>(selector: string) =>
    document.body.querySelector<T>(`.dam-image-detail ${selector}`)
  /** The server has processed the file, the queue has asked, and the upload dialog has read the asset. */
  const processed = async (parts: Record<string, unknown>) => {
    await vi.waitFor(() => expect(item().status).toBe(Processing))
    dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, parts)
    await waits.elapse()
    await vi.waitFor(() => expect(item().status).toBe(Uploaded))
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-1'))
    await damNamesAsked()
    await flushPromises()
  }
  /** What the DAM has for the uploaded file: a description, and whoever each application takes for the source. */
  const withAnAuthor = {
    ...metadata({ description: ' a lead image ', author: ' A. Author ' }),
    authors: isCms ? ['author-1'] : [],
  }
  const source = isCms ? 'Name of author-1' : 'A. Author'
  const saveAndApply = async () => {
    inUploadDialog<HTMLElement>('[data-cy="button-save-and-apply"]')!.click()
    await vi.waitFor(() => expect(useImageMediaWidgetStore(pinia).detail).not.toBeNull())
    await flushPromises()
  }
  /** The dialog of the image the widget is about to save. */
  const imageDialog = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(damText('image.meta.edit'))
    )
  // A growing text field has a hidden twin that measures it.
  const textsIn = (root: Element) =>
    Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  const confirmImage = () =>
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === uiText('common.button.confirm'))!
      .click()
  /** What the image API is sent: the fields of an image, and nothing else (finding 36). */
  const savedImage = {
    texts: { description: 'a lead image', source },
    dam: { damId: 'file-1', licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  }
  /** What the upload dialog hands the widget: the map of an upload adds the asset and its authors, which ride along. */
  const handedImage = { ...savedImage, authorIds: isCms ? ['author-1'] : [], assetId: 'asset-1' }
  const existing: ImageAware = {
    id: 7,
    texts: { description: 'the image before', source: 'Agency' },
    dam: { damId: 'file-before', licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  }

  describe('a file picked through the menu of the widget', () => {
    it('is queued under the key of the widget, in its upload licence, and the upload dialog opens over it', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      useExtSystemIdForCached().cachedExtSystemId.value = 0
      const widget = await mountWidget()
      expect(uploadDialog()).toBeNull()

      await pickThroughMenu(widget, [photo()])
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      await flushPromises()

      expect(queue().getQueueItems(QUEUE)).toMatchObject([
        { displayTitle: 'photo.jpg', licenceId: licence, status: Uploading },
      ])
      const [first] = dam.requests
      expect(`${first.method} ${first.url}`).toBe(`POST ${endPoints.image}/licence/${licence}`)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      expect(uploadDialog()!.textContent).toContain(damText('upload.title'))
      // The names of the authors and keywords of the rows are asked for by the ext system of the widget.
      expect(useExtSystemIdForCached().cachedExtSystemId.value).toBe(extSystem)
      // The dialog that offered the file input is closed again.
      expect(fileInputOfDialog()).toBeNull()
      expect(shownAlerts()).toEqual([])
    })

    it('opens the upload dialog of that widget alone: a widget with another key shows none', async () => {
      dam.hold('POST', dam.routes.chunk)
      const widget = await mountWidget()
      const other = await mountWidget({ queueKey: 'another-image' })

      await pickThroughMenu(widget, [photo()])

      expect([
        widget.findComponent(UploadQueueDialogSingle).exists(),
        other.findComponent(UploadQueueDialogSingle).exists(),
      ]).toEqual([true, false])
      expect(queue().getQueueItems('another-image')).toEqual([])
    })

    it('is queued the same way when it is dropped onto the widget', async () => {
      dam.hold('POST', dam.routes.chunk)
      const widget = await mountWidget()

      widget
        .find('.a-file-dropzone')
        .element.dispatchEvent(
          new DragEvent('drop', { dataTransfer: carrying([photo('dropped.jpg')]), bubbles: true, cancelable: true })
        )
      await vi.waitFor(() => expect(queue().getQueueItems(QUEUE)).toHaveLength(1))
      await flushPromises()

      expect(item().displayTitle).toBe('dropped.jpg')
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      expect(uploadDialog()).not.toBeNull()
    })

    // Finding 47: the widget holds one image, and its upload dialog shows one file. The others used to be uploaded
    // as well, unseen, saved with the switches of the first, and left in the DAM without an image.
    describe.each<[string, Component]>([
      ['the image widget', ImageWidgetInner],
      ['the image and media widget', ImageMediaWidgetInner],
    ])('dropped onto %s', (_which, component) => {
      const dropped = async (widget: VueWrapper, ...files: File[]) => {
        widget
          .find('.a-file-dropzone')
          .element.dispatchEvent(
            new DragEvent('drop', { dataTransfer: carrying(files), bubbles: true, cancelable: true })
          )
        await vi.waitFor(() => expect(queue().getQueueItems(QUEUE).length).toBeGreaterThan(0))
        await flushPromises()
      }

      it('with another: the first is queued alone, the user is told, and the upload dialog opens over it', async () => {
        const widget = await mountWidget({}, component)

        await dropped(widget, photo('first.jpg'), photo('second.jpg'), photo('third.jpg'))

        expect(shownAlerts()).toEqual([['warning', alertText('common.damImage.upload.onlyOneFile')]])
        expect(damText('upload.onlyOneFile')).toBe('Only one file can be uploaded here; the first one is used.')
        expect(
          queue()
            .getQueueItems(QUEUE)
            .map((row) => row.displayTitle)
        ).toEqual(['first.jpg'])
        expect(dam.sentTo('POST', dam.routes.start)).toHaveLength(1)
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
        expect(uploadDialog()).not.toBeNull()
      })

      it('alone: is queued without a word, as before', async () => {
        const widget = await mountWidget({}, component)

        await dropped(widget, photo('only.jpg'))

        expect(shownAlerts()).toEqual([])
        expect(
          queue()
            .getQueueItems(QUEUE)
            .map((row) => row.displayTitle)
        ).toEqual(['only.jpg'])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      })
    })

    // Finding 30: the file is turned away with a warning, and that is all. Nothing is queued, and no upload dialog
    // opens over a queue without a row: it used to, and showed a loader until it was closed.
    describe.each<[string, Component]>([
      ['the image widget', ImageWidgetInner],
      ['the image and media widget', ImageMediaWidgetInner],
    ])('of a type the ext system does not take, in %s', (_which, component) => {
      const turnedAway = () => {
        expect(shownAlerts()).toEqual([
          ['warning', `${alertText('common.system.upload.incorrectFormatSize')}:scan.tiff`],
        ])
        expect(queue().getQueueItems(QUEUE)).toEqual([])
        expect(dam.requests).toEqual([])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
        expect(uploadDialog()).toBeNull()
      }

      it('picked through the menu: is turned away with a warning, and no upload dialog opens', async () => {
        const widget = await mountWidget({}, component)

        await pickThroughMenu(widget, [photo('scan.tiff', 'image/tiff')])

        turnedAway()
      })

      const dropTurnedAway = async (widget: VueWrapper) => {
        widget.find('.a-file-dropzone').element.dispatchEvent(
          new DragEvent('drop', {
            dataTransfer: carrying([photo('scan.tiff', 'image/tiff')]),
            bubbles: true,
            cancelable: true,
          })
        )
        await flushPromises()
      }

      it('dropped onto the widget: is turned away with a warning, and no upload dialog opens', async () => {
        const widget = await mountWidget({}, component)

        await dropTurnedAway(widget)

        turnedAway()
      })

      // What is left of the files goes on as before: the one the ext system takes is queued, the other is named.
      it('dropped together with one it takes: that one is queued, and the upload dialog opens over it', async () => {
        const chunks = dam.hold('POST', dam.routes.chunk)
        const widget = await mountWidget({}, component)

        widget.find('.a-file-dropzone').element.dispatchEvent(
          new DragEvent('drop', {
            dataTransfer: carrying([photo('scan.tiff', 'image/tiff'), photo('taken.jpg')]),
            bubbles: true,
            cancelable: true,
          })
        )
        await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))

        expect(shownAlerts()).toEqual([
          ['warning', `${alertText('common.system.upload.incorrectFormatSize')}:scan.tiff`],
        ])
        expect(queue().getQueueItems(QUEUE)).toMatchObject([{ displayTitle: 'taken.jpg' }])
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
        expect(uploadDialog()).not.toBeNull()
      })

      // The turn before left nothing behind: the widget takes the next file as any other.
      it('and then one it takes: that one is queued, and the upload dialog opens over it', async () => {
        const widget = await mountWidget({}, component)
        await dropTurnedAway(widget)
        forgetAlerts()

        await pickThroughMenu(widget, [photo()])

        expect(shownAlerts()).toEqual([])
        await vi.waitFor(() => expect(queue().getQueueItems(QUEUE)).toHaveLength(1))
        expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
        expect(uploadDialog()).not.toBeNull()
      })
    })
  })

  describe('"save and apply" of its upload dialog', () => {
    it('hands the widget the image, which opens the dialog of the image with its texts, and the upload is over', async () => {
      const widget = await mountWidget()
      await pickThroughMenu(widget, [photo()])
      await processed(withAnAuthor)

      await saveAndApply()

      expect(useImageMediaWidgetStore(pinia).detail).toEqual(handedImage)
      expect(textsIn(imageDialog()!).map((field) => field.value)).toEqual(['a lead image', source])
      // admin-ugc names the source its own way and has no "show source" switch.
      const { sourceLabel } = useCommonAdminCoreDamOptions()
      expect(imageDialog()!.textContent).toContain(sourceLabel)
      expect(imageDialog()!.querySelector('.v-switch') !== null).toBe(isCms)
      // The upload dialog has closed itself and emptied its queue.
      expect(uploadDialog()).toBeNull()
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      // Nothing is saved as an image yet, and the widget still has none.
      expect(imageApi.calls).toEqual([])
      expect(widget.emitted('update:modelValue')).toBeUndefined()
    })

    it('then "confirm" saves a new image through the image API of the application, and the widget takes its id', async () => {
      const widget = await mountWidget()
      await pickThroughMenu(widget, [photo()])
      await processed(withAnAuthor)
      await saveAndApply()

      confirmImage()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await flushPromises()

      // Only the fields of an image are sent, and the widget shows the image from the answer: it used to read the
      // image it had just created once more (finding 36).
      expect(imageApi.calls).toEqual([['createImage', savedImage]])
      expect(Object.keys(imageApi.calls[0]![1] as object).sort()).toEqual(['dam', 'flags', 'position', 'texts'])
      // admin-cms leaves the save to the library, which asks the CMS backend; admin-ugc saves by its own function.
      expect(imageApi.requests.map((request) => `${request.method} ${request.url}`)).toEqual(
        isCms ? ['POST /adm/v1/image'] : []
      )
      expect(widget.emitted('update:modelValue')).toEqual([[501]])
      expect(modelValueOf(widget)).toBe(501)
      expect(imageDialog()).toBeUndefined()
      expect(useImageMediaWidgetStore(pinia).detail).toBeNull()
      expect(widget.findComponent({ name: 'VImg' }).attributes('src')).toBe(pictureOf('file-1'))
      expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
      expect(shownAlerts().filter(([colour]) => colour !== 'success')).toEqual([])
    })

    // The widget of an image or a media saves the same way: the fields of an image, and no read of it afterwards.
    it('then "confirm" in the image and media widget saves a new image the same way', async () => {
      const widget = await mountWidget({}, ImageMediaWidgetInner)
      await pickThroughMenu(widget, [photo()])
      await processed(withAnAuthor)
      await saveAndApply()
      expect(useImageMediaWidgetStore(pinia).detail).toEqual(handedImage)

      confirmImage()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await flushPromises()

      expect(imageApi.calls).toEqual([['createImage', savedImage]])
      expect(Object.keys(imageApi.calls[0]![1] as object).sort()).toEqual(['dam', 'flags', 'position', 'texts'])
      expect(imageApi.requests.map((request) => `${request.method} ${request.url}`)).toEqual(
        isCms ? ['POST /adm/v1/image'] : []
      )
      expect(widget.emitted('update:image')).toEqual([[501]])
      expect(widget.findComponent({ name: 'VImg' }).attributes('src')).toBe(pictureOf('file-1'))
      expect(shownAlerts().filter(([colour]) => colour !== 'success')).toEqual([])
    })

    // Only that once: an id the model is changed to afterwards is read, also the one of the image the widget created.
    it('reads the image its model is changed to after that, as before', async () => {
      const widget = await mountWidget()
      await pickThroughMenu(widget, [photo()])
      await processed(withAnAuthor)
      await saveAndApply()
      confirmImage()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await flushPromises()
      imageApi.has(existing)

      await widget.setProps({ modelValue: existing.id })
      await flushPromises()
      await widget.setProps({ modelValue: 501 })
      await flushPromises()

      expect(imageApi.calls.slice(1)).toEqual([
        ['fetchImage', existing.id],
        ['fetchImage', 501],
      ])
      expect(widget.findComponent({ name: 'VImg' }).attributes('src')).toBe(pictureOf('file-1'))
    })

    describe('in the image and media widget', () => {
      /** The widget has created its image, 501; `props` say what its parent does with the id it is handed. */
      const created = async (props: Record<string, unknown> = {}) => {
        const widget = await mountWidget(props, ImageMediaWidgetInner)
        await pickThroughMenu(widget, [photo()])
        await processed(withAnAuthor)
        await saveAndApply()
        confirmImage()
        await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
        await flushPromises()
        expect(imageApi.calls).toEqual([['createImage', savedImage]])
        return widget
      }
      /** A video of the DAM, as the form holds it. */
      const video = {
        damMedia: {
          imageFileId: null,
          assetId: 'asset-video',
          licenceId: licence,
          assetType: 'video',
          title: 'Evening news',
          description: '',
          seriesName: '',
          authorNames: [],
          publishedAt: null,
          duration: 120,
          mediaUrl: null,
          playable: false,
          syncedWithDam: true,
          episodeName: '',
          episodeNumber: null,
        },
        extService: 'damVideo',
      }

      it('reads the image its model is changed to after that, as before', async () => {
        const widget = await created()
        imageApi.has(existing)

        await widget.setProps({ image: existing.id })
        await flushPromises()
        await widget.setProps({ image: 501 })
        await flushPromises()

        expect(imageApi.calls.slice(1)).toEqual([
          ['fetchImage', existing.id],
          ['fetchImage', 501],
        ])
      })

      // The parent has not taken the id of the created image, and puts a media into the form first: that run of the
      // watcher ends at the media. The image the parent names afterwards is read, though it is the created one.
      it('reads the created image when its parent names it only after a media', async () => {
        const widget = await created({ 'onUpdate:image': () => undefined })

        await widget.setProps({ media: video })
        await flushPromises()
        await widget.setProps({ media: null, image: 501 })
        await flushPromises()

        expect(imageApi.calls.slice(1)).toEqual([['fetchImage', 501]])
      })
    })

    it('keeps the id of the image the widget already has: "confirm" updates that image', async () => {
      const widget = await mountWidget({ modelValue: 7, image: existing })
      expect(widget.findComponent({ name: 'VImg' }).attributes('src')).toBe(pictureOf('file-before'))
      await pickThroughMenu(widget, [photo()])
      await processed(withAnAuthor)

      await saveAndApply()
      expect(useImageMediaWidgetStore(pinia).detail).toEqual({ ...handedImage, id: 7 })
      confirmImage()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await flushPromises()

      expect(imageApi.calls).toEqual([['updateImage', 7, { ...savedImage, id: 7 }]])
      expect(imageApi.requests.map((request) => `${request.method} ${request.url}`)).toEqual(
        isCms ? ['PUT /adm/v1/image/7'] : []
      )
      expect(modelValueOf(widget)).toBe(7)
      expect(widget.findComponent({ name: 'VImg' }).attributes('src')).toBe(pictureOf('file-1'))
    })

    // An uploaded file whose asset has no author gives the image no source. admin-cms requires one, and the
    // dialog does not save without it; admin-ugc does not require it.
    it('of a file without an author: the image has no source, which only admin-cms asks the user to fill in', async () => {
      const widget = await mountWidget()
      await pickThroughMenu(widget, [photo()])
      await processed(metadata({ description: 'a lead image' }))
      await saveAndApply()
      expect(textsIn(imageDialog()!).map((field) => field.value)).toEqual(['a lead image', ''])

      confirmImage()
      await flushPromises()

      if (!isCms) {
        await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
        expect(imageApi.calls[0]).toMatchObject(['createImage', { texts: { description: 'a lead image', source: '' } }])
        return
      }
      expect(shownAlerts().at(-1)).toEqual(['error', alertText('common.alert.fixValidationErrors')])
      expect(imageApi.calls).toEqual([])
      expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
      expect(imageDialog()).toBeDefined()

      const sourceField = textsIn(imageDialog()!)[1]
      sourceField.value = 'Typed Source'
      sourceField.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
      confirmImage()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      expect(imageApi.calls[0]).toMatchObject(['createImage', { texts: { source: 'Typed Source' } }])
    })
  })

  // The embed dialog of both applications: the buttons of the widget in a row instead of behind a menu, and the
  // texts of the image as a form in the page instead of in a dialog, saved when the host asks for it.
  describe('with its options and its image form expanded', () => {
    const expanded = { expandOptions: true, expandMetadata: true }
    const buttonsOf = (widget: VueWrapper) => widget.findAll('.a-image-widget__options button')
    const pickThroughButton = async (widget: VueWrapper, files: File[]) => {
      await buttonsOf(widget)
        .find((button) => button.text() === damText('image.button.upload'))!
        .trigger('click')
      await vi.waitFor(() => expect(fileInputOfDialog()).not.toBeNull())
      const input = fileInputOfDialog()!
      input.files = carrying(files).files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await flushPromises()
    }

    it('offers the library and the upload as two buttons, with no menu', async () => {
      const widget = await mountWidget(expanded)

      expect(buttonsOf(widget).map((button) => button.text())).toEqual([
        useCommonAdminCoreDamOptions().addFromDamLabel,
        damText('image.button.upload'),
      ])
      expect(widget.find(`button[aria-label="${damText('image.button.options')}"]`).exists()).toBe(false)
      expect(textsIn(widget.element)).toEqual([])
    })

    it('shows the uploaded image and its texts in the page after "save and apply", and saves them when the host confirms', async () => {
      const widget = await mountWidget(expanded)
      await pickThroughButton(widget, [photo()])
      await processed(withAnAuthor)

      await saveAndApply()
      await flushPromises()

      // No dialog of the image: its form is in the widget, and the picture is the uploaded one already.
      expect(imageDialog()).toBeUndefined()
      expect(textsIn(widget.element).map((field) => field.value)).toEqual(['a lead image', source])
      expect(widget.findComponent({ name: 'VImg' }).attributes('src')).toBe(pictureOf('file-1'))
      expect(imageApi.calls).toEqual([])
      expect(uploadDialog()).toBeNull()

      ;(widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await flushPromises()

      expect(imageApi.calls[0]).toEqual(['createImage', savedImage])
      expect(modelValueOf(widget)).toBe(501)
      expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1)
      // The button of the library now offers to replace the image.
      expect(buttonsOf(widget).map((button) => button.text())).toContain(
        useCommonAdminCoreDamOptions().replaceFromDamLabel
      )
    })

    it('updates the image the widget already has when the host confirms', async () => {
      const widget = await mountWidget({ ...expanded, modelValue: 7, image: existing })
      expect(textsIn(widget.element).map((field) => field.value)).toEqual(['the image before', 'Agency'])
      await pickThroughButton(widget, [photo()])
      await processed(withAnAuthor)
      await saveAndApply()

      ;(widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

      expect(imageApi.calls).toEqual([['updateImage', 7, { ...savedImage, id: 7 }]])
      expect(modelValueOf(widget)).toBe(7)
    })
  })

  // Read from the code when the tests were planned, and never run: the queue and the dialog that is open belong
  // to the page, not to the widget that started them.
  describe('a queue whose widget is taken away while the upload dialog is open', () => {
    it('goes on, and a widget mounted with the same key afterwards shows the dialog and the file again', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      const widget = await mountWidget()
      await pickThroughMenu(widget, [photo()])
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      const signal = chunks.waiting[0]!.request.config.signal as AbortSignal

      widget.unmount()
      mounted = []
      await flushPromises()

      expect(uploadDialog()).toBeNull()
      expect(queue().getQueueItems(QUEUE)).toMatchObject([{ displayTitle: 'photo.jpg', status: Uploading }])
      expect(signal.aborted).toBe(false)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)

      const again = await mountWidget()
      expect(again.findComponent(UploadQueueDialogSingle).exists()).toBe(true)
      expect(uploadDialog()!.textContent).toContain(damText('upload.title'))

      // The upload ends in the new widget as it would have in the old one.
      chunks.release()
      await processed(withAnAuthor)
      await saveAndApply()
      expect(useImageMediaWidgetStore(pinia).detail).toEqual(handedImage)
      expect(imageDialog()).toBeDefined()
    })
  })
})
