import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, forgetAlerts, signInToDam, signOutOfDam, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import type { DocId } from '@/shared/types/common'

// Author names of the DAM are looked up under the ext system of the asset's
// licence everywhere, like the read of a held asset and the read before a write.
// Pick and confirm used the ext system of the picker, and the gallery that of the page. With
// today's data they are the same, so the test uses an asset of a licence of another ext system.
// The DAM names an author after the ext system it is asked under. admin-cms only (admin-ugc has no DAM authors).

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const OTHER_LICENCE = licence + 1
const OTHER_EXT_SYSTEM = extSystem + 1
const UNKNOWN_LICENCE = licence + 2
const named = (author: DocId) => `Name of ${author} in ${OTHER_EXT_SYSTEM}`
const MEDIA = /^\/adm\/v1\/cms\/asset\//
const SEARCH = new RegExp(
  `^${endPoints.asset.replace(/\//g, '\\/')}\\/licence\\/(\\d+)\\/search\\?assetAndMainFileIds=([^&]*)`
)
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})

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
  // The DAM names an author after the ext system it is asked under.
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(DAM_NAMES) : null
    if (!match || match[1] !== 'author') return undefined
    const ids = (new URLSearchParams(match[3]).get('id') ?? '').split(',')
    const found = ids.map((id) => ({
      id,
      name: `Name of ${id} in ${match[2]}`,
      identifier: '',
      flags: { reviewed: true },
    }))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(SEARCH) : null
    if (!match) return undefined
    const files = match[2]!.split(',')
    const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  const config = useDamConfigStore(pinia)
  config.damConfigLicenceExtSystem.set(OTHER_LICENCE, { name: 'other', extSystem: OTHER_EXT_SYSTEM })
  config.damConfigExtSystem.set(OTHER_EXT_SYSTEM, config.damConfigExtSystem.get(extSystem)!)
  config.damConfigAssetCustomFormElements.set(OTHER_EXT_SYSTEM, config.damConfigAssetCustomFormElements.get(extSystem)!)
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
const inTheDam = (id: string, authors: DocId[] = [], of = OTHER_LICENCE) =>
  dam.assets.set(
    id,
    damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
      licence: of,
      authors,
      metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
    })
  )
const listed = (id: string) => ({
  id,
  licence: OTHER_LICENCE,
  mainFile: { id: `file-of-${id}` },
  mainFileInternal: false,
  attributes: { assetType: DamAssetType.Image },
  podcasts: [],
})
const imageDialog = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.textContent?.includes(damText('image.meta.edit'))
  )
const fieldsIn = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
    (field) => field.getAttribute('aria-hidden') !== 'true'
  )
const confirmButton = () =>
  Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === uiText('common.button.confirm')
  )!
const sourcesSaved = () =>
  imageApi.calls.flatMap(([call, ...args]) => {
    if (call === 'createImage') return [(args[0] as ImageAware).texts.source]
    if (call === 'updateImage') return [(args[1] as ImageAware).texts.source]
    if (call === 'bulkUpdateImages') return (args[0] as ImageAware[]).map((image) => image.texts.source)
    return []
  })

describe.each<[string, Component]>([
  ['the image widget', ImageWidgetInner],
  ['the image and media widget', ImageMediaWidgetInner],
])('%s, of an asset of a licence of another ext system', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner
  const mountWidget = async () => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        queueKey: 'names-image',
        uploadLicence: licence,
        selectLicences: [licence, OTHER_LICENCE],
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
          AAssetSelect: Picker,
          AAssetSelectMedia: Picker,
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
    useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
    return mounted
  }
  const pick = async (widget: VueWrapper, asset: string) => {
    widget.findComponent(Picker).vm.$emit('confirm', { type: 'asset', value: [listed(asset)] })
    await vi.waitFor(() =>
      expect(useImageMediaWidgetStore(pinia).detail).toMatchObject({ dam: { damId: `file-of-${asset}` } })
    )
    await vi.waitFor(() => expect(confirmButton().disabled).toBe(false))
    await flushPromises()
  }

  it('names the authors of a picked asset in the source of its image under the ext system of its licence', async () => {
    inTheDam('asset-7', ['author-1'])
    const widget = await mountWidget()

    await pick(widget, 'asset-7')

    expect(fieldsIn(imageDialog()!).map((field) => field.value)).toContain(named('author-1'))
  })

  it('names the authors picked in its dialog under the ext system of the licence of the asset, once saved', async () => {
    inTheDam('asset-9')
    const widget = await mountWidget()
    await pick(widget, 'asset-9')
    widget.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-5'])
    await flushPromises()

    confirmButton().click()
    await vi.waitFor(() => expect(widget.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

    expect(sourcesSaved()).toEqual([named('author-5')])
  })
})

describe('the widget of several images, of assets of a licence of another ext system', () => {
  const images = () => useImageStore(pinia).images
  const mountGallery = async (ids: number[], of = OTHER_LICENCE) => {
    ids.forEach((id, index) => {
      imageApi.has({
        id,
        texts: { description: `image ${id}`, source: '' },
        dam: { damId: `file-of-asset-${id}`, licenceId: of, regionPosition: 0, internal: false },
        flags: { showSource: true, internal: false, overrideInternal: false },
        position: index + 1,
      })
      inTheDam(`asset-${id}`, [], of)
    })
    const mounted: VueWrapper = mount(ImageWidgetMultipleInner, {
      attachTo: document.body,
      props: {
        modelValue: ids,
        queueKey: 'names-gallery',
        uploadLicence: licence,
        selectLicences: [licence, OTHER_LICENCE],
        'onUpdate:modelValue': (value: number[]) => mounted.setProps({ modelValue: value }),
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          ASortableListEditor: Editor,
          AAssetSelect: Picker,
          AssetDetailDialogFrame: true,
          AImageWidgetSimple: true,
          AssetImage: true,
          AssetQueueSelectedSidebar: true,
          AFileDropzone: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    widgets.push(mounted)
    await vi.waitFor(() => expect(images()).toHaveLength(ids.length))
    await damNamesAsked()
    await flushPromises()
    useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
    return mounted
  }

  it('names the authors picked in a row under the ext system of the licence of its asset, as it saves', async () => {
    const gallery = await mountGallery([12])
    gallery
      .findComponent(ImageWidgetMultipleItem)
      .findComponent(AuthorRemoteAutocompleteWithCached)
      .vm.$emit('update:modelValue', ['author-5'])
    await flushPromises()
    await damNamesAsked()

    expect(await (gallery.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()).toBe(true)

    expect(sourcesSaved()).toEqual([named('author-5')])
  })

  it('names the authors of "fill empty" in each row under the ext system of the licence of its asset', async () => {
    await mountGallery([12])

    await useImageMassOperations('default').replaceEmptyAuthors(['author-5'])
    await flushPromises()

    expect(images()[0]!.texts.source).toBe(named('author-5'))
  })

  it('names the authors of an asset picked in the library under the ext system of its licence', async () => {
    const gallery = await mountGallery([])
    inTheDam('asset-13', ['author-3'])

    gallery.findComponent(Picker).vm.$emit('confirm', { type: 'asset', value: [listed('asset-13')] })
    await vi.waitFor(() => expect(images()).toHaveLength(1))

    expect(images()[0]!.texts.source).toBe(named('author-3'))
  })

  // Rows of a licence the page has not loaded take their ext system from
  // what the page knows, or the page's own. No licence is read for them.
  const licenceReads = () => dam.requests.filter((request) => request.url.startsWith('/adm/v1/asset-licence/'))
  it('reads no licence the page does not know as it saves: the names go under the ext system of the page', async () => {
    const gallery = await mountGallery([12], UNKNOWN_LICENCE)
    gallery
      .findComponent(ImageWidgetMultipleItem)
      .findComponent(AuthorRemoteAutocompleteWithCached)
      .vm.$emit('update:modelValue', ['author-5'])
    await flushPromises()
    await damNamesAsked()
    const before = licenceReads().length

    expect(await (gallery.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()).toBe(true)

    expect(licenceReads()).toHaveLength(before)
    expect(sourcesSaved()).toEqual([`Name of author-5 in ${extSystem}`])
  })

  it('reads no licence the page does not know for "fill empty": the names go under the ext system of the page', async () => {
    await mountGallery([12], UNKNOWN_LICENCE)
    const before = licenceReads().length

    await useImageMassOperations('default').replaceEmptyAuthors(['author-5'])
    await flushPromises()

    expect(licenceReads()).toHaveLength(before)
    expect(images()[0]!.texts.source).toBe(`Name of author-5 in ${extSystem}`)
  })
})
