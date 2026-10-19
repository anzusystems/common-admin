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
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { createDamImage } from '@/domains/dam/imageWidget/utils/damImage'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'

// A widget of one image that has none yet: "confirm" of its image dialog creates the image. While that create is on
// its way, the dialog can be closed and opened again for another pick in the library or another upload, made for a
// widget without an image: its image had no id, and its confirm, once the create had answered, created a second
// image, which the widget took, and the first one was left unused. Under admin-cms. The real widgets with their real
// dialog of the image; the DAM and the backend of the images are clients that record their requests. The asset
// picker and the upload dialog are stand-ins, of which the picker answers as the real one does; the pictures are not
// drawn.

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const QUEUE = 'lead-image'
const MEDIA = /^\/adm\/v1\/cms\/asset\/(.+)$/
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
])('the image dialog of %s, opened again while the image of its first confirm is being created', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    answerDamNames(dam)
    // What the image and media widget asks about a picked asset first: of an image there is nothing to say.
    dam.reply((request) =>
      request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined
    )
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
  /** What the DAM has for an asset: `file-of-<id>`, described, with an author, in the licence of the widget. */
  const inTheDam = (id: string, author: string) =>
    dam.assets.set(
      id,
      damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
        licence,
        authors: [author],
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
  // The dialogs of the widget are drawn into the body.
  const imageDialog = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(damText('image.meta.edit'))
    )
  // A growing text field has a hidden twin that measures it.
  const texts = () =>
    Array.from(imageDialog()!.querySelectorAll<HTMLTextAreaElement>('textarea'))
      .filter((field) => field.getAttribute('aria-hidden') !== 'true')
      .map((field) => field.value)
  const confirmButton = () =>
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === uiText('common.button.confirm')
    )!
  const spins = () => confirmButton().classList.contains('v-btn--loading')
  const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')
  const imageOf = (widget: VueWrapper) =>
    (widget.props() as { modelValue?: number | null; image?: number | null })[isImageWidget ? 'modelValue' : 'image']
  const saved = (widget: VueWrapper) => widget.emitted('afterMetadataSaveSuccess') ?? []
  /** The widget without an image, with its buttons in a row, as it is in a form. */
  const mountWidget = async (key = QUEUE) => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: key,
        uploadLicence: licence,
        selectLicences: [licence],
        expandOptions: true,
        ...(isImageWidget
          ? {
              modelValue: null,
              'onUpdate:modelValue': (value: number | null) => mounted.setProps({ modelValue: value }),
            }
          : {
              image: null,
              media: null,
              'onUpdate:image': (value: number | null) => mounted.setProps({ image: value }),
              'onUpdate:media': (value: unknown) => mounted.setProps({ media: value }),
            }),
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
  /** The user confirms the image asset in the picker of the widget; nothing is to be copied. */
  const pickInLibrary = async (widget: VueWrapper, asset: string) => {
    widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed(asset)] })
    await vi.waitFor(() => expect(shown()).toMatchObject({ dam: { damId: `file-of-${asset}` } }))
    await vi.waitFor(() => expect(texts()).toEqual([`of ${asset}`, `Name of author-of-${asset}`]))
    await flushPromises()
  }
  /** The queue dialog of the widget applies an uploaded file: the dialog of its image opens. */
  const applyUpload = async (widget: VueWrapper) => {
    useUploadQueueDialog().uploadQueueDialog.value = QUEUE
    await flushPromises()
    widget
      .findComponent(UploadStandIn)
      .vm.$emit('apply', [
        createDamImage({ fileId: 'file-uploaded', licenceId: licence }, { description: 'uploaded', source: 'Upload' }),
      ])
    useUploadQueueDialog().uploadQueueDialog.value = null
    await vi.waitFor(() => expect(texts()).toEqual(['uploaded', 'Upload']))
    await flushPromises()
  }
  const closeImageDialog = async () => {
    imageDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
    await vi.waitFor(() => expect(imageDialog()).toBeUndefined())
  }
  /**
   * An asset is picked into the widget without an image, and "confirm" pressed in its dialog: the image is being
   * created, till the case lets the backend answer. The dialog is closed then.
   */
  const createdOnItsWayAndClosed = async () => {
    inTheDam('asset-9', 'author-of-asset-9')
    const widget = await mountWidget()
    await pickInLibrary(widget, 'asset-9')
    const saves = imageApi.holdSaves()
    confirmButton().click()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    await closeImageDialog()
    return { widget, saves }
  }

  it.each<[string, (widget: VueWrapper) => Promise<void>, string]>([
    [
      'for another asset picked in the library',
      async (widget) => {
        inTheDam('asset-10', 'author-of-asset-10')
        await pickInLibrary(widget, 'asset-10')
      },
      'file-of-asset-10',
    ],
    ['for an uploaded file', applyUpload, 'file-uploaded'],
  ])(
    '%s: its confirm is not taken till the image is created, and then replaces that image, no second one is created',
    async (_for, openAgain, file) => {
      const { widget, saves } = await createdOnItsWayAndClosed()
      await openAgain(widget)
      const ofThatDialog = texts()

      // The button spins while the image is being created, and a press is not taken.
      expect(spins()).toBe(true)
      confirmButton().click()
      await waits.settle()
      expect(imagesWritten()).toHaveLength(1)

      saves.release()
      await vi.waitFor(() => expect(saved(widget)).toHaveLength(1))
      await waits.settle()
      expect(imageOf(widget)).toBe(501)
      expect(imageDialog()).toBeDefined()
      expect(spins()).toBe(false)
      expect(texts()).toEqual(ofThatDialog)

      confirmButton().click()
      await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
      saves.release()
      await vi.waitFor(() => expect(saved(widget)).toHaveLength(2))
      await waits.settle()

      expect(imagesWritten()).toMatchObject([
        ['createImage', { dam: { damId: 'file-of-asset-9' } }],
        ['updateImage', 501, { id: 501, dam: { damId: file } }],
      ])
      expect([...imageApi.images.keys()]).toEqual([501])
      expect(imageOf(widget)).toBe(501)
      expect(imageDialog()).toBeUndefined()
      expect(shownAlerts()).toEqual([])
    }
  )

  // The store of the image dialog is one for the page. Another widget, whose pick was still being read, opens its
  // dialog over this one and puts its image there while this image is being created: the created id went to that
  // image, and its confirm updated this widget's image with the file and texts of the other one.
  it('gives the created id to no image another widget has put into the store of the dialog meanwhile', async () => {
    inTheDam('asset-9', 'author-of-asset-9')
    inTheDam('asset-10', 'author-of-asset-10')
    const widget = await mountWidget()
    const another = await mountWidget('another-image')
    await pickInLibrary(widget, 'asset-9')
    const saves = imageApi.holdSaves()
    confirmButton().click()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    another.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed('asset-10')] })
    await vi.waitFor(() => expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-10' } }))
    await flushPromises()

    saves.release()
    await vi.waitFor(() => expect(saved(widget)).toHaveLength(1))
    await waits.settle()
    expect(imageOf(widget)).toBe(501)
    expect(shown()).toMatchObject({ dam: { damId: 'file-of-asset-10' } })
    expect(shown()).not.toHaveProperty('id')

    // The other widget confirms its own pick, as a host confirms the form: it creates its own image.
    ;(another.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    saves.release()
    await vi.waitFor(() => expect(saved(another)).toHaveLength(1))

    expect(imagesWritten()).toMatchObject([
      ['createImage', { dam: { damId: 'file-of-asset-9' } }],
      ['createImage', { dam: { damId: 'file-of-asset-10' } }],
    ])
    expect([imageOf(widget), imageOf(another)]).toEqual([501, 502])
    expect(shownAlerts()).toEqual([])
  })

  // Nothing was created: the image of the dialog opened again is the widget's first, and its confirm creates it.
  it('for another asset picked in the library, when that create fails: its confirm creates the image', async () => {
    const { widget, saves } = await createdOnItsWayAndClosed()
    inTheDam('asset-10', 'author-of-asset-10')
    await pickInLibrary(widget, 'asset-10')

    saves.release('failed')
    await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
    await waits.settle()
    expect(imageOf(widget)).toBeNull()
    expect(imageDialog()).toBeDefined()
    expect(shown()).not.toHaveProperty('id')

    confirmButton().click()
    await vi.waitFor(() => expect(saves.waiting).toHaveLength(1))
    saves.release()
    await vi.waitFor(() => expect(saved(widget)).toHaveLength(1))

    expect(imagesWritten()).toMatchObject([
      ['createImage', { dam: { damId: 'file-of-asset-9' } }],
      ['createImage', { dam: { damId: 'file-of-asset-10' } }],
    ])
    expect(imageOf(widget)).toBe(501)
  })
})
