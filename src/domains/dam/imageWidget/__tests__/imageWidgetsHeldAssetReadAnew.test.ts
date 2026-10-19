import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
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
import { updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
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

// "Edit image" of an image whose asset a widget of one image holds: an asset picked in the library without authors,
// whose authors the dialog of that image offers in place of a source. The widget read the asset at its pick and
// never again, so the dialog went on offering the pick of authors the asset may have been given elsewhere since (in
// the DAM, by another editor, by another widget of the page), and its "confirm" wrote what was picked over them. It
// also offered again what was picked in a dialog closed without a confirm. The asset is read anew as the dialog
// opens, which shows its loading till then. admin-cms only: admin-ugc has no authors of the DAM, so its dialog never
// offers them. The real widgets with their real dialog of the image; the DAM and the backend of the images are
// clients that record their requests; the asset picker is a stand-in that answers as the real one does.

const QUEUE = 'lead-image'
const PickerStandIn = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const MEDIA = /^\/adm\/v1\/cms\/asset\//

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widgets: VueWrapper[] = []

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  // What the image and media widget asks about a picked asset first: here, it is no media.
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
})
afterEach(async () => {
  widgets.forEach((widget) => widget.unmount())
  widgets = []
  useUploadQueueDialog().uploadQueueDialog.value = null
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
/** What the DAM has for an asset: `file-of-<id>`, described, in the licence of the widget, without authors. */
const inTheDam = (id: string) =>
  dam.assets.set(
    id,
    damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
      licence,
      authors: [],
      metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
    })
  )
/** The asset is given authors elsewhere: in the DAM, by another editor or another widget of the page. */
const givenAuthorsElsewhere = (id: string, authors: DocId[]) => {
  dam.assets.get(id)!.authors = authors
}
/** An asset as the list of the picker has it. */
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
// The dialog of the image is drawn into the body.
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.textContent?.includes(damText('image.meta.edit'))
  )
// A growing text field has a hidden twin that measures it.
const fieldsIn = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
    (field) => field.getAttribute('aria-hidden') !== 'true'
  )
/** The texts the dialog of the image shows: the description, and the source where it has that field. */
const texts = () => fieldsIn(imageDialog()!).map((field) => field.value)
/** The dialog shows its loading, and nothing of the image. */
const loading = () => !isNull(imageDialog()!.querySelector('.v-progress-circular'))
const buttonOfDialog = (text: string) =>
  Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text
  )!
const confirmButton = () => buttonOfDialog(uiText('common.button.confirm'))
/** What each save of metadata wrote into the DAM: the asset and its authors. */
const authorsWritten = () =>
  dam
    .sentTo('PATCH', dam.routes.bulkMetadata)
    .map((request) =>
      (dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>).map((one) => [one.id, one.authors])
    )
/** The reads of an asset by its id: what a pick reads, and what "edit image" reads anew. */
const readsOf = (asset: DocId) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
const imagesWritten = () => imageApi.calls.filter(([call]) => call === 'createImage' || call === 'updateImage')
/** The reads of an asset by its id wait; `answer` lets them answer with what the DAM has by then. */
const holdReadsOf = (asset: DocId) => {
  const held = dam.hold('GET', new RegExp(`^${endPoints.asset}/${asset}$`))
  return {
    waiting: held.waiting,
    answer: (given?: FakeDamAnswer) =>
      held.release(given ?? { status: 200, data: structuredClone(dam.assets.get(asset)) }),
  }
}
const refuseReadsOf = (asset: DocId) =>
  dam.reply((request) =>
    request.method === 'GET' && request.url === `${endPoints.asset}/${asset}` ? { status: 500 } : undefined
  )

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('"edit image" of %s, for an image whose asset it holds', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  /** The widget with its buttons in a row, as it is in a form; `image`: the id of the image the entity has. */
  const mountWidget = async (image: number | null = null, key = QUEUE) => {
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
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          AAssetSelect: PickerStandIn,
          AAssetSelectMedia: PickerStandIn,
          UploadQueueDialogSingle: true,
          AssetDetailDialogFrame: true,
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
  /** "Edit image" of the widget: the dialog of the image it has, maybe still loading. */
  const editImage = async (widget: VueWrapper) => {
    const button = () =>
      widget.findAll('.a-image-widget__options button').find((one) => one.text() === damText('image.meta.edit'))
    await vi.waitFor(() => expect(button()).toBeDefined())
    await button()!.trigger('click')
    await vi.waitFor(() => expect(imageDialog()).toBeDefined())
  }
  /** The same, once the dialog shows the image. */
  const editImageShown = async (widget: VueWrapper) => {
    await editImage(widget)
    await vi.waitFor(() => expect(loading()).toBe(false))
    await flushPromises()
  }
  const closeImageDialog = async () => {
    imageDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
    await vi.waitFor(() => expect(imageDialog()).toBeUndefined())
  }
  /** "Confirm" of the dialog, until the widget has saved its image. */
  const confirmImage = async (widget: VueWrapper) => {
    const saved = widget.emitted('afterMetadataSaveSuccess')?.length ?? 0
    confirmButton().click()
    await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(saved + 1))
    await flushPromises()
  }
  /** As a host confirms the form: by the method the widget exposes. */
  const confirmAsHost = (widget: VueWrapper) =>
    (widget.vm as unknown as { metadataConfirm: () => void }).metadataConfirm()
  const authorsInput = (widget: VueWrapper) => widget.findComponent(AuthorRemoteAutocompleteWithCached)
  /** What the dialog offers: the authors picked in it so far, or `null` where it shows the source. */
  const offered = (widget: VueWrapper) =>
    authorsInput(widget).exists() ? (authorsInput(widget).props('modelValue') as DocId[]) : null
  const pickAuthors = async (widget: VueWrapper, authors: DocId[]) => {
    authorsInput(widget).vm.$emit('update:modelValue', authors)
    await flushPromises()
  }
  /** The asset is picked in the library, and the dialog of its image offers the authors of the DAM. */
  const pickedWithoutAuthors = async (image: number | null = null) => {
    inTheDam('asset-9')
    if (!isNull(image)) imageApi.has(stored(image))
    const widget = await mountWidget(image)
    widget.findComponent(PickerStandIn).vm.$emit('confirm', { type: 'asset', value: [listed('asset-9')] })
    await vi.waitFor(() =>
      expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: 'file-of-asset-9' } })
    )
    await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
    await flushPromises()
    expect(offered(widget)).toEqual([])
    return widget
  }
  /** As above, and the image is saved without an author: the widget holds the asset on. */
  const savedWithoutAuthors = async () => {
    const widget = await pickedWithoutAuthors()
    await confirmImage(widget)
    expect(imagesWritten()).toMatchObject([['createImage', { texts: { source: '' } }]])
    return widget
  }

  it('shows the names of the authors the asset was given since as the source of the image, and writes no authors', async () => {
    const widget = await savedWithoutAuthors()
    givenAuthorsElsewhere('asset-9', ['author-3'])

    await editImageShown(widget)

    expect(readsOf('asset-9')).toHaveLength(2)
    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
    expect(shownAlerts()).toEqual([])
    await confirmImage(widget)
    expect(authorsWritten()).toEqual([])
    expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'Name of author-3' } }])
    expect(dam.assets.get('asset-9')!.authors).toEqual(['author-3'])
  })

  // The pick was written into the asset the widget holds, and nothing took it back when the dialog was closed.
  it('offers none of the authors picked in a dialog closed without a confirm: the pick starts from what the DAM has', async () => {
    const widget = await savedWithoutAuthors()
    await editImageShown(widget)
    await pickAuthors(widget, ['author-5'])
    expect(offered(widget)).toEqual(['author-5'])
    await closeImageDialog()

    await editImageShown(widget)

    expect(readsOf('asset-9')).toHaveLength(3)
    expect(offered(widget)).toEqual([])
    await confirmImage(widget)
    expect(authorsWritten()).toEqual([])
    expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: '' } }])
  })

  // The title says what the dialog is for, the same while it loads.
  it('shows only its loading while the asset is read: neither its "confirm" nor that of a host takes anything', async () => {
    const widget = await savedWithoutAuthors()
    givenAuthorsElsewhere('asset-9', ['author-3'])
    const reads = holdReadsOf('asset-9')

    await editImage(widget)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    expect(imageDialog()).toBeDefined()
    expect(loading()).toBe(true)
    expect(texts()).toEqual([])
    expect(confirmButton().disabled).toBe(true)
    confirmButton().click()
    confirmAsHost(widget)
    await waits.settle()
    expect(imagesWritten()).toHaveLength(1)
    expect(authorsWritten()).toEqual([])

    reads.answer()
    await vi.waitFor(() => expect(loading()).toBe(false))
    await flushPromises()

    expect(offered(widget)).toBeNull()
    expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
    expect(confirmButton().disabled).toBe(false)
    expect(imagesWritten()).toHaveLength(1)
  })

  it('says once that the asset could not be read, and offers the pick as before', async () => {
    const widget = await savedWithoutAuthors()
    refuseReadsOf('asset-9')

    await editImageShown(widget)

    expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
    expect(offered(widget)).toEqual([])
    expect(texts()).toEqual(['of asset-9'])
    await confirmImage(widget)
    expect(authorsWritten()).toEqual([])
    expect(shownAlerts()).toHaveLength(1)
  })

  it.each<[string, 'closed' | 'gone', FakeDamAnswer | undefined]>([
    ['the dialog was closed, and the read finds authors', 'closed', undefined],
    ['the dialog was closed, and the read fails', 'closed', { status: 500 }],
    ['the widget is gone, and the read finds authors', 'gone', undefined],
    ['the widget is gone, and the read fails', 'gone', { status: 500 }],
  ])('takes nothing of the read, and says nothing, when %s', async (_when, what, answer) => {
    const widget = await savedWithoutAuthors()
    givenAuthorsElsewhere('asset-9', ['author-3'])
    const reads = holdReadsOf('asset-9')
    await editImage(widget)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))

    if (what === 'closed') {
      await closeImageDialog()
    } else {
      widget.unmount()
      widgets = []
    }
    reads.answer(answer)
    await damNamesAsked()
    await waits.settle()

    expect(shownAlerts()).toEqual([])
    expect(useImageMediaWidgetStore(pinia).detail).toBeNull()
    expect(imagesWritten()).toHaveLength(1)
    if (what === 'gone') return
    // The widget holds the asset as before: opened again, the dialog reads it once more.
    await editImage(widget)
    await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
    reads.answer()
    await vi.waitFor(() => expect(loading()).toBe(false))
    await flushPromises()
    expect(readsOf('asset-9')).toHaveLength(3)
    expect(texts()).toEqual(['of asset-9', 'Name of author-3'])
  })

  // Another widget of the page has the same image, and shows its source: what is typed there and saved is the image's
  // own, and stays when the asset the first widget holds turns out to have authors, as an empty source would not.
  it('keeps the source a save of the image by another widget gave it, once the detail "edit asset" opened gives the asset authors', async () => {
    const widget = await savedWithoutAuthors()
    const other = await mountWidget(501, 'other-image')
    await editImageShown(other)
    expect(texts()).toEqual(['of asset-9', ''])
    const source = fieldsIn(imageDialog()!)[1]!
    source.value = 'typed elsewhere'
    source.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await confirmImage(other)
    expect(imagesWritten().at(-1)).toMatchObject(['updateImage', 501, { texts: { source: 'typed elsewhere' } }])

    // The first widget takes the image as that save left it, and still offers the authors of the asset.
    await editImageShown(widget)
    expect(offered(widget)).toEqual([])
    dam.reply((request) => {
      if (request.method !== 'PATCH' || !dam.routes.bulkMetadata.test(request.url)) return undefined
      givenAuthorsElsewhere('asset-9', ['author-9'])
      return undefined
    })
    buttonOfDialog(useCommonAdminCoreDamOptions().editAssetLabel).click()
    await vi.waitFor(() => expect(useAssetDetailStore(pinia).asset?.id).toBe('asset-9'))
    await flushPromises()
    const { damClient, endPointAsset } = useCommonAdminCoreDamOptions()
    const asset = useAssetDetailStore(pinia).asset!
    asset.authors = ['author-9']
    await updateAssetMetadata(damClient, endPointAsset, asset, extSystem, useAssetDetailStore(pinia).mainFileSingleUse)
    widget.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
    await vi.waitFor(() => expect(offered(widget)).toBeNull())
    await damNamesAsked()
    await flushPromises()

    expect(texts()).toEqual(['of asset-9', 'typed elsewhere'])
  })

  it.each<[string, boolean]>([
    ['an image the entity has, with its source', false],
    ['the image the widget has, of another file than the asset it holds', true],
  ])('reads nothing for %s, and opens at once', async (_what, holdsAnAsset) => {
    let widget: VueWrapper
    if (holdsAnAsset) {
      widget = await pickedWithoutAuthors(7)
      await closeImageDialog()
    } else {
      imageApi.has(stored(7))
      widget = await mountWidget(7)
    }
    const reads = dam.sentTo('GET', dam.routes.one).length

    await editImage(widget)
    await flushPromises()

    expect(loading()).toBe(false)
    expect(texts()).toEqual(['image 7', 'source 7'])
    expect(dam.sentTo('GET', dam.routes.one)).toHaveLength(reads)
    expect(shownAlerts()).toEqual([])
  })
})
