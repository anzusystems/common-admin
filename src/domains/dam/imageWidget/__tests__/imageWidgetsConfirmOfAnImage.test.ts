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

// Covers "Confirm" of the image dialog and the answers it waits
// for: author names, the DAM authors write and the image save.
// The dialog can be closed and reopened for another image or a
// media meanwhile, and the widget can go away with its host dialog.
// admin-cms only (it has DAM authors). The DAM and the image backend are request-recording clients.
// The asset picker and the upload dialog are stand-ins.

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
  const inTheDam = (id: string, authors: string[] = []) =>
    dam.assets.set(
      id,
      damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
        licence,
        authors,
        metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
  const listed = (id: string) => ({
    id,
    licence,
    mainFile: { id: `file-of-${id}` },
    mainFileInternal: false,
    attributes: { assetType: DamAssetType.Image },
    podcasts: [],
  })
  const stored = (id: number): ImageAware => ({
    id,
    texts: { description: `image ${id}`, source: `source ${id}` },
    dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
    flags: { showSource: true, internal: false, overrideInternal: false },
    position: 1,
  })
  // The widget dialogs are rendered into the body.
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
  const texts = () => fieldsIn(imageDialog()!).map((field) => field.value)
  const confirmButton = () =>
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === uiText('common.button.confirm')
    )!
  const spins = () => confirmButton().classList.contains('v-btn--loading')
  const authorsWritten = () =>
    dam
      .sentTo('PATCH', dam.routes.bulkMetadata)
      .map((request) =>
        (dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>).map((one) => [one.id, one.authors])
      )
  const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')
  const imageOf = (widget: VueWrapper) =>
    (widget.props() as { modelValue?: number | null; image?: number | null })[isImageWidget ? 'modelValue' : 'image']
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
  const takeAway = (widget: VueWrapper) => {
    widget.unmount()
    widgets = widgets.filter((one) => one !== widget)
  }
  const pickInLibrary = async (widget: VueWrapper, asset: string) => {
    widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed(asset)] })
    await vi.waitFor(() => expect(shown()).toMatchObject({ dam: { damId: `file-of-${asset}` } }))
    await flushPromises()
  }
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
  const confirmAsHost = (widget: VueWrapper) =>
    (widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
  const pickAuthors = async (widget: VueWrapper, authors: DocId[]) => {
    widget.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
    await flushPromises()
    // What the caches ask of the picked author is asked by now: the read held next is the one of "confirm".
    await damNamesAsked()
  }
  const pickedWithSource = async (image: number | null = null) => {
    inTheDam('asset-9', ['author-3'])
    const widget = await mountWidget(image)
    await pickInLibrary(widget, 'asset-9')
    await vi.waitFor(() => expect(texts()).toEqual(['of asset-9', 'Name of author-3']))
    return widget
  }
  const pickedWithAuthorsToSave = async (image: number | null = null) => {
    inTheDam('asset-9')
    const widget = await mountWidget(image)
    await pickInLibrary(widget, 'asset-9')
    await vi.waitFor(() => expect(widget.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(true))
    await pickAuthors(widget, ['author-7'])
    return widget
  }

  // The image save is the last thing a confirm waits for.
  // Once it answers, the image is saved whatever the dialog shows, and the widget takes it.
  // What happens to a dialog opened meanwhile depends on what it shows.
  describe('whose save answers', () => {
    // Guards a regression: "Edit metadata" opened while a pick is
    // being saved shows a copy of the image from before the save.
    // Left open, its confirm silently saved the old file and texts over the pick.
    // The dialog is closed with the answer and the widget shows the saved image.
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

      await editImage(widget)
      expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
    })

    // Guards a regression: the dialog of another pick was closed by
    // this confirm's answer without a press, and the pick was lost.
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

    // Guards a regression: the embed dialogs draw the form from the page-wide store of the image dialog.
    // A cancelled host takes its widget away while its image is
    // saved, and the next widget has its own image in that store.
    // The first answer emptied the store and put the first image there.
    // The second dialog's confirm then updated the first image and gave its id to the second.
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

  // Before the image is saved, a confirm may wait twice: for the author names and for the DAM to take the authors.
  // Guards a regression: when the widget went away meanwhile, the confirm
  // still wrote the authors and saved the image of a missing widget.
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

    // Guards a regression: the dialog takes a video or podcast at the press with nothing to wait for.
    // If taken while an image save was on its way, the save answer set the image and took the video away.
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

    // Guards a regression: the dialog also shows a picked video or podcast.
    // If opened for one while the authors of an earlier confirmed image were
    // being written, it was taken for that image once the DAM answered.
    // An image with none of its fields was sent to be created, and the media dialog closed.
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
