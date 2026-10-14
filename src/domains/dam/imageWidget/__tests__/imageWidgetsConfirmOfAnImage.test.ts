import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  damText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import type { DocId } from '@/shared/types/common'
import { isNull } from '@/shared/utils/common'

// "Confirm" of the dialog of the image of the two widgets of one image, and what the answers it waits for find when
// they come: the names of the authors picked in the dialog, the write of those authors into the DAM, the save of the
// image. The dialog can be closed meanwhile and opened again for another image, or for a media, and the widget can go
// away with the dialog of its host. Under admin-cms, which has the authors of the DAM. The real widgets with their real
// dialog of the image; the DAM and the backend of the images are clients that record their requests. The asset picker
// and the upload dialog are stand-ins, of which the picker answers as the real one does; the pictures are not drawn.

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const QUEUE = 'lead-image'
const MEDIA = /^\/adm\/v1\/cms\/asset\/(.+)$/
const NAMES_OF_AUTHOR_7 = /^\/adm\/v1\/author\/ext-system\/\d+\/search\?.*author-7/
const author7Named = {
  status: 200,
  data: {
    data: [{ id: 'author-7', name: 'Name of author-7', identifier: '', flags: { reviewed: true } }],
    totalCount: 1,
  },
}
const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const UploadStandIn = defineComponent({
  name: 'UploadQueueDialogSingle',
  emits: ['apply'],
  setup: () => () => h('div'),
})

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widgets: VueWrapper[] = []

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('"confirm" of the dialog of the image of %s', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    // What the image and media widget asks about a picked asset first: of an image there is nothing to say.
    dam.reply((request) => {
      const media = request.method === 'GET' ? request.url.match(MEDIA) : null
      if (!media) return undefined
      return {
        status: 200,
        data: media[1]!.startsWith('video')
          ? {
              title: 'A video',
              description: '',
              seriesName: '',
              authorNames: [],
              publishedAt: null,
              duration: 10,
              mediaUrl: '',
              playable: true,
              episodeName: '',
              episodeNumber: null,
            }
          : {},
      }
    })
    // Each read of an asset is answered with a copy: what the page makes of an answer is not what the DAM has.
    dam.reply((request) => {
      const byId = request.method === 'GET' ? request.url.match(dam.routes.one) : null
      const found = byId ? dam.assets.get(byId[1]!) : undefined
      return found ? { status: 200, data: structuredClone(found) } : undefined
    })
    waits = holdLongWaits()
    forgetAlerts()
    signInToDam(extSystem)
  })
  afterEach(async () => {
    widgets.forEach((widget) => widget.unmount())
    widgets = []
    useUploadQueueDialog().uploadQueueDialog.value = null
    useSidebar().closeSidebarRight()
    await damNamesAsked()
    waits.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  const shown = () => useImageMediaWidgetStore(pinia).detail
  /** What the DAM has for an asset: `file-of-<id>`, described, in the licence of the widget. */
  const inTheDam = (id: string, authors: string[] = []) =>
    dam.assets.set(
      id,
      damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
        licence,
        authors,
        metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
  /** An image as the list of the picker has it. */
  const listed = (id: string) => ({
    id,
    licence,
    mainFile: { id: `file-of-${id}` },
    mainFileInternal: false,
    attributes: { assetType: DamAssetType.Image },
    podcasts: [],
  })
  /** An image the entity already has, of a file of its own. */
  const stored = (id: number): ImageAware => ({
    id,
    texts: { description: `image ${id}`, source: `source ${id}` },
    dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  })
  // The dialogs of the widget are drawn into the body.
  const dialogNamed = (title: string) =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(title)
    )
  const imageDialog = () => dialogNamed(damText('image.meta.edit'))
  const mediaDialog = () => dialogNamed(damText('media.meta.edit'))
  // A growing text field has a hidden twin that measures it.
  const fieldsIn = (root: Element) =>
    Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
      (field) => field.getAttribute('aria-hidden') !== 'true'
    )
  /** The texts the dialog of the image shows: the description, and the source where it has that field. */
  const texts = () => fieldsIn(imageDialog()!).map((field) => field.value)
  const confirmButton = () =>
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === uiText('common.button.confirm')
    )!
  const spins = () => confirmButton().classList.contains('v-btn--loading')
  /** What each save of metadata wrote into the DAM: the asset and its authors. */
  const authorsWritten = () =>
    dam
      .sentTo('PATCH', dam.routes.bulkMetadata)
      .map((request) =>
        (dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>).map((one) => [one.id, one.authors])
      )
  const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')
  /** The id of the image the widget holds: what its form reads. */
  const imageOf = (widget: VueWrapper) =>
    (widget.props() as { modelValue?: number | null; image?: number | null })[isImageWidget ? 'modelValue' : 'image']
  /**
   * The widget with its buttons in a row, as it is in a form; `image`: the id of the image the entity has, which the
   * backend of the images has too.
   */
  const mountWidget = async (image: number | null = null, more: Record<string, unknown> = {}, key = QUEUE) => {
    if (!isNull(image)) imageApi.has(stored(image))
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: key,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        ...(isImageWidget
          ? {
              modelValue: image,
              'onUpdate:modelValue': (value: number | null) => mounted.setProps({ modelValue: value }),
            }
          : {
              image,
              media: null,
              'onUpdate:image': (value: number | null) => mounted.setProps({ image: value }),
              'onUpdate:media': (value: unknown) => mounted.setProps({ media: value }),
            }),
        ...more,
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          AAssetSelect: PickerStandIn,
          AAssetSelectMedia: PickerStandIn,
          UploadQueueDialogSingle: UploadStandIn,
          AssetDetailDialog: true,
          VImg: true,
          AImageWidgetSimple: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    widgets.push(mounted)
    await flushPromises()
    // As the picker leaves it once it has been opened.
    useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
    return mounted
  }
  /** The widget goes away, as with the dialog of a host that is cancelled. */
  const takeAway = (widget: VueWrapper) => {
    widget.unmount()
    widgets = widgets.filter((one) => one !== widget)
  }
  /** The user confirms the image asset in the picker of the widget; nothing is to be copied. */
  const pickInLibrary = async (widget: VueWrapper, asset: string) => {
    widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed(asset)] })
    await vi.waitFor(() => expect(shown()).toMatchObject({ dam: { damId: `file-of-${asset}` } }))
    await flushPromises()
  }
  /** "Edit image" of the widget: the dialog of the image it has. */
  const editImage = async (widget: VueWrapper) => {
    const button = () =>
      widget.findAll('.a-image-widget__options button').find((one) => one.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(button()).toBeDefined())
    await button()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
    await flushPromises()
  }
  const closeImageDialog = async () => {
    imageDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
    await vi.waitFor(() => expect(imageDialog()).toBeUndefined())
  }
  /** As a host confirms the form drawn in its page: by the method the widget exposes. */
  const confirmAsHost = (widget: VueWrapper) =>
    (widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
  const pickAuthors = async (widget: VueWrapper, authors: DocId[]) => {
    widget.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
    await flushPromises()
    // What the caches ask of the picked author is asked by now: the read held next is the one of "confirm".
    await damNamesAsked()
  }
  /** An asset with its author is picked: the dialog of its image shows the source, and its save asks the DAM nothing. */
  const pickedWithSource = async (image: number | null = null) => {
    inTheDam('asset-9', ['author-3'])
    const widget = await mountWidget(image)
    await pickInLibrary(widget, 'asset-9')
    await vi.waitFor(() => expect(texts()).toEqual(['of asset-9', 'Name of author-3']))
    return widget
  }
  /** An asset without an author is picked, and `author-7` picked for it in the dialog of its image. */
  const pickedWithAuthorsToSave = async (image: number | null = null) => {
    inTheDam('asset-9')
    const widget = await mountWidget(image)
    await pickInLibrary(widget, 'asset-9')
    await vi.waitFor(() => expect(widget.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(true))
    await pickAuthors(widget, ['author-7'])
    return widget
  }

  // The save of the image is the last thing a confirm waits for. Once it has answered the image is saved, whatever
  // the dialog shows by then: the widget takes it. What becomes of a dialog opened meanwhile depends on what it shows.
  describe('whose save answers', () => {
    // "Edit metadata" opens the dialog on a copy of the image the widget has. Opened while a pick is being saved, that
    // copy is of the image before the save: left open, its confirm saved the old file and the old texts over the pick,
    // without a word. It is closed with the answer, as it always was, and the widget shows the saved image.
    it('once the dialog was closed and opened again by "edit metadata": the widget takes the saved image, and that dialog, a copy from before the save, is closed', async () => {
      const widget = await pickedWithSource(7)
      const saves = imageApi.holdSaves()
      confirmButton().click()
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

      await closeImageDialog()
      await editImage(widget)
      expect(texts()).toEqual(['image 7', 'source 7'])
      saves.release()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await waits.settle()

      expect(imagesWritten()).toMatchObject([['updateImage', 7, { dam: { damId: 'file-of-asset-9' } }]])
      expect(imageOf(widget)).toBe(7)
      expect([imageDialog(), shown()]).toEqual([undefined, null])
      expect(shownAlerts()).toEqual([])

      // Opened again, it shows the image as it was saved.
      await editImage(widget)
      expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
    })

    // The dialog of another pick is not that confirm's to close: it was closed with the answer, without a press, and
    // the pick was lost.
    it('once the dialog was closed and another asset picked in the library: the widget takes the saved image, and the dialog of that pick stays open', async () => {
      const widget = await pickedWithSource(7)
      inTheDam('asset-10', ['author-4'])
      const saves = imageApi.holdSaves()
      confirmButton().click()
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

      await closeImageDialog()
      await pickInLibrary(widget, 'asset-10')
      await vi.waitFor(() => expect(texts()).toEqual(['of asset-10', 'Name of author-4']))
      saves.release()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await waits.settle()

      expect(imagesWritten()).toMatchObject([['updateImage', 7, { dam: { damId: 'file-of-asset-9' } }]])
      expect(imageOf(widget)).toBe(7)
      expect([texts(), spins()]).toEqual([['of asset-10', 'Name of author-4'], false])
      expect(shownAlerts()).toEqual([])

      // That dialog takes a confirm of its own, for the asset picked in it.
      confirmButton().click()
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
      saves.release()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(2))
      expect(imagesWritten()[1]).toMatchObject(['updateImage', 7, { dam: { damId: 'file-of-asset-10' } }])
      expect(imageDialog()).toBeUndefined()
    })

    it('once the dialog was closed and not opened again: the widget takes the saved image, as before', async () => {
      const widget = await pickedWithSource()
      const saves = imageApi.holdSaves()
      confirmButton().click()
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

      await closeImageDialog()
      saves.release()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await waits.settle()

      expect(imagesWritten()).toMatchObject([['createImage', { dam: { damId: 'file-of-asset-9' } }]])
      expect(imageOf(widget)).toBe(501)
      expect([imageDialog(), shown()]).toEqual([undefined, null])
      expect(shownAlerts()).toEqual([])
    })

    // The embed dialogs of the two applications draw the form in their own dialog (`expandMetadata`), and that form
    // is drawn from the store of the dialog of the image, one for the page. A host that is cancelled while its image
    // is saved takes its widget away, and the next one opened has a widget of its own, with its image in that store:
    // the answer of the first emptied it and then put the first image there, and the confirm of the second dialog
    // updated the first image and gave its id to the second.
    it('once the widget has gone and the next one shows its own image: that form stays as it is, and its confirm saves its image', async () => {
      const first = await mountWidget(7, { expandMetadata: true })
      await vi.waitFor(() => expect(shown()).toMatchObject({ id: 7 }))
      const saves = imageApi.holdSaves()
      confirmAsHost(first)
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))

      takeAway(first)
      const second = await mountWidget(8, { expandMetadata: true }, 'another-embed')
      await vi.waitFor(() => expect(shown()).toMatchObject({ id: 8 }))
      await flushPromises()
      const formOfTheSecond = () => fieldsIn(second.element.parentElement!).map((field) => field.value)
      expect(formOfTheSecond()).toEqual(['image 8', 'source 8'])
      saves.release()
      await waits.settle()

      expect(shown()).toMatchObject({ id: 8, texts: { description: 'image 8' }, dam: { damId: 'file-8' } })
      expect(formOfTheSecond()).toEqual(['image 8', 'source 8'])
      expect(imageOf(second)).toBe(8)
      expect(first.emitted('afterMetadataSaveSuccess')).toBeUndefined()

      confirmAsHost(second)
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
      saves.release()
      await vi.waitFor(() => expect(second.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      expect(imagesWritten().map(([call, id]) => [call, id])).toEqual([
        ['updateImage', 7],
        ['updateImage', 8],
      ])
      expect(imagesWritten()[1]).toMatchObject(['updateImage', 8, { texts: { description: 'image 8' } }])
      expect(imageOf(second)).toBe(8)
      expect(shownAlerts()).toEqual([])
    })
  })

  // Before the image is saved a confirm may wait twice: for the names of the authors picked in the dialog, and for
  // the DAM to take those authors. The widget can go away meanwhile, with the dialog of a host that is cancelled:
  // the confirm went on all the same, wrote the authors and saved the image of a widget that was no longer there.
  describe('pressed with authors picked, when the widget goes away', () => {
    it.each<[string, boolean, unknown[]]>([
      ['the names of those authors are read: nothing is written into the DAM, and no image is saved', true, []],
      ['the DAM takes those authors: no image is saved', false, [[['asset-9', ['author-7']]]]],
    ])('while %s', async (_when, atTheNames, written) => {
      const widget = await pickedWithAuthorsToSave()
      const held = atTheNames ? dam.hold('GET', NAMES_OF_AUTHOR_7) : dam.hold('PATCH', dam.routes.bulkMetadata)
      confirmButton().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

      takeAway(widget)
      held.release(atTheNames ? author7Named : undefined)
      await damNamesAsked()
      await waits.settle()

      expect(authorsWritten()).toEqual(written)
      expect(imagesWritten()).toEqual([])
      expect(widget.emitted('afterMetadataSaveSuccess')).toBeUndefined()
      expect(shownAlerts()).toEqual([])
    })
  })

  if (!isImageWidget) {
    /** The user confirms a video in the picker of the widget: the dialog of the media opens. */
    const pickVideo = async (widget: VueWrapper) => {
      widget.findComponent(PickerStandIn).vm.$emit('confirm', {
        type: 'asset',
        value: [
          {
            id: 'video-1',
            licence,
            mainFile: { id: 'file-of-video-1', _resourceName: 'videoFile', imagePreview: null },
            mainFileInternal: false,
            attributes: { assetType: DamAssetType.Video },
            podcasts: [],
          },
        ],
      })
      await vi.waitFor(() => expect(mediaDialog()).toBeDefined())
      await flushPromises()
    }
    const mediaOf = (widget: VueWrapper) => (widget.props() as { media: unknown }).media
    const confirmOfMedia = () =>
      Array.from(mediaDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === uiText('common.button.confirm')
      )!

    // The dialog of this widget takes a video or a podcast at the press, with nothing to wait for. Taken while the
    // save of an image was on its way, the video was the widget's only until that save answered: the answer set the
    // image and took the video away.
    it('is not taken for a video while the image of an earlier confirm is being saved: its button spins till that save answers, and the next press takes the video', async () => {
      const widget = await pickedWithSource()
      const saves = imageApi.holdSaves()
      confirmButton().click()
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
      await closeImageDialog()
      await pickVideo(widget)
      expect(confirmOfMedia().classList.contains('v-btn--loading')).toBe(true)

      confirmOfMedia().click()
      await waits.settle()
      expect([imageOf(widget), mediaOf(widget)]).toEqual([null, null])
      expect(mediaDialog()).toBeDefined()

      saves.release()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))
      await waits.settle()
      expect([imageOf(widget), mediaOf(widget)]).toEqual([501, null])
      expect(mediaDialog()).toBeDefined()
      expect(confirmOfMedia().classList.contains('v-btn--loading')).toBe(false)

      confirmOfMedia().click()
      await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(2))
      await flushPromises()
      expect(imageOf(widget)).toBeNull()
      expect(mediaOf(widget)).toMatchObject({ damMedia: { assetId: 'video-1' } })
      expect(mediaDialog()).toBeUndefined()
      expect(shownAlerts()).toEqual([])
    })

    // The dialog of this widget shows a picked video or podcast as well. Opened for one while the authors of an
    // image confirmed before were being written, it was taken for that image once the DAM had answered: an image
    // with none of its fields was sent to be created, and the dialog of the media closed.
    it('pressed with authors picked, sends no image and leaves the dialog open, when that dialog shows a video by the time the DAM has taken the authors', async () => {
      const widget = await pickedWithAuthorsToSave()
      const writes = dam.hold('PATCH', dam.routes.bulkMetadata)
      confirmButton().click()
      await vi.waitFor(() => expect(writes.waiting).toHaveLength(1))

      await closeImageDialog()
      await pickVideo(widget)
      writes.release()
      await waits.settle(200)

      expect(authorsWritten()).toEqual([[['asset-9', ['author-7']]]])
      expect(imagesWritten()).toEqual([])
      expect(mediaDialog()).toBeDefined()
      expect(shown()).toMatchObject({ damMedia: { assetId: 'video-1' } })
      expect([imageOf(widget), widget.emitted('afterMetadataSaveSuccess')]).toEqual([null, undefined])
      expect(shownAlerts()).toEqual([])
    })
  }
})
