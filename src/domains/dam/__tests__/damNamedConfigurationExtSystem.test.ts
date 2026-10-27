import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, damAsset, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { type DamConfigOfDam, fillDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { forgetAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import ImageMassOperations from '@/domains/dam/imageWidget/components/ImageMassOperations.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { createDamImage } from '@/domains/dam/imageWidget/utils/damImage'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'

const { endPoints, extSystem: EXT_DEFAULT, licence: LICENCE_DEFAULT } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const OWN_AUTHOR = '/own/v2/author'
const EXT_OWN = 2
const LICENCE_OWN = 300003
const NAMES = /^(.*)\/(author|keyword)\/ext-system\/(\d+)\/search$/
/** Waits from this length are held. The caches wait 1.5 s before they ask. */
const HELD_FROM_MS = 1_200

const ofOwn: DamConfigOfDam = {
  extSystem: EXT_OWN,
  licence: LICENCE_OWN,
  fieldName: 'Headline of own',
  keywords: false,
  authors: true,
  chunk: { minSize: 1048576, maxSize: 52428800 },
  distribution: { title: 'YouTube of own', iconPath: '/own-youtube.svg' },
  externalProvider: 'Provider of own',
}

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let wrappers: VueWrapper[] = []
let errors: unknown[] = []

const answerNames = (of: FakeDam, which: string) =>
  of.reply((request) => {
    const [path, query] = request.url.split('?')
    if (request.method !== 'GET' || !NAMES.test(path!)) return undefined
    const ids = (new URLSearchParams(query).get('id') ?? '').split(',')
    const found = ids.map((id) => ({ id, name: `${id} of ${which}`, identifier: '', flags: { reviewed: true } }))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  answerNames(dam, 'default')
  answerNames(own, 'own')
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: {
      ...coreDam.configs,
      own: { damClient: own.client, endPointAsset: OWN.asset, endPointImage: OWN.image, endPointAuthor: OWN_AUTHOR },
    },
  })
  initCommonAdminImageOptions({ ...image, configs: { ...image.configs, own: image.configs.default! } })
  fillDamConfigOf('own', ofOwn)
  waits = holdLongWaits(HELD_FROM_MS)
  forgetAlerts()
  errors = []
  useExtSystemIdForCached('default').cachedExtSystemId.value = 0
  useExtSystemIdForCached('own').cachedExtSystemId.value = 0
})
afterEach(async () => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  useAssetDetailStore().dialog = null
  await waits.elapseAll()
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const askedForNames = (of: FakeDam) =>
  of.requests
    .map((request) => `${request.method} ${request.url.split('?')[0]}`)
    .filter((request) => NAMES.test(request.split(' ')[1]!))
const cachesAsk = async () => {
  await waits.elapse()
  await flushPromises()
}
const mounted = (component: Component, options: Record<string, unknown>) => {
  const wrapper = mount(component, options)
  wrappers.push(wrapper)
  return wrapper
}

const UnderOwn = defineComponent({
  setup(_, { slots }) {
    useDamConfigName('own')

    return () => slots.default?.()
  },
})

const widgetStandIns = Object.fromEntries(
  [
    'VImg',
    'AImageWidgetSimple',
    'UploadQueueDialogSingle',
    'UploadQueueDialog',
    'AAssetSelect',
    'AssetImage',
    'DamAssetImageRoiSelectLazy',
    'AssetDetailSidebarROI',
    'AFormRemoteAutocompleteWithCached',
  ].map((name) => [name, true])
)
const queueOf = (name: 'default' | 'own') => `named-ext-system-${name}`
const mountWidget = async (name: 'default' | 'own') => {
  const wrapper = mounted(AImageWidgetMultiple, {
    attachTo: document.body,
    props: {
      modelValue: [],
      queueKey: queueOf(name),
      uploadLicence: name === 'own' ? LICENCE_OWN : LICENCE_DEFAULT,
      selectLicences: [name === 'own' ? LICENCE_OWN : LICENCE_DEFAULT],
      configName: name,
    },
    global: {
      plugins: [pinia],
      stubs: widgetStandIns,
      config: { errorHandler: (error: unknown) => errors.push(error) },
    },
  })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('.v-progress-circular').exists()).toBe(false))
  await flushPromises()
}
const orders = [
  ['own', 'default'],
  ['default', 'own'],
] as const

describe.each(orders)('two widgets of two configurations, mounted %s, then %s', (first, last) => {
  it('each configuration asks for names under its own ext system, whichever wrote last', async () => {
    await mountWidget(first)
    await mountWidget(last)

    const { addToCachedAuthors: toDefault, fetchCachedAuthors: fetchDefault } = useDamCachedAuthors('default')
    const { addToCachedAuthors: toOwn, fetchCachedAuthors: fetchOwn } = useDamCachedAuthors('own')
    toDefault([`author-${first}-${last}`])
    toOwn([`author-${first}-${last}`])
    fetchDefault()
    fetchOwn()
    await cachesAsk()

    expect(askedForNames(dam)).toEqual([`GET /adm/v1/author/ext-system/${EXT_DEFAULT}/search`])
    expect(askedForNames(own)).toEqual([`GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`])
  })

  // The detail opened from a row must use its widget's configuration and ext system.
  // With the page's ext system, written last by the other widget,
  // it threw "Ext system must be initialised." and was not drawn.
  it(`the asset detail of the widget under ${first} opens with the rules of ${first}`, async () => {
    await mountWidget(first)
    await mountWidget(last)

    const detail = useAssetDetailStore()
    detail.dialog = queueOf(first)
    detail.setAsset(damAsset('asset-shown', { licence: first === 'own' ? LICENCE_OWN : LICENCE_DEFAULT }))
    await flushPromises()

    expect(errors).toEqual([])
    const shown = document.body.querySelector('.dam-image-detail')?.textContent ?? ''
    if (first === 'own') {
      expect(shown).toContain(ofOwn.fieldName)
      expect(wrappers[0]!.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(false)
    } else {
      expect(shown).not.toContain(ofOwn.fieldName)
      expect(wrappers[0]!.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(true)
    }
  })
})

describe('the authors of the image dialogs under a named configuration, after a widget of default wrote its ext system', () => {
  const imageOfPick = (): ImageStoreItem =>
    ({
      ...createDamImage({ fileId: 'file-1', licenceId: LICENCE_OWN }, { description: '', source: '' }),
      key: 'image-1',
      showDamAuthors: true,
      damAuthors: [],
    }) as unknown as ImageStoreItem

  it('the mass operations offer the authors, and search them, under the ext system of that configuration', async () => {
    useExtSystemIdForCached('own').cachedExtSystemId.value = EXT_OWN
    useExtSystemIdForCached('default').cachedExtSystemId.value = EXT_DEFAULT
    useImageStore().setImages([imageOfPick()])

    const subject = mounted(defineComponent({ setup: () => () => h(UnderOwn, () => h(ImageMassOperations)) }), {
      attachTo: document.body,
      global: { plugins: [pinia], stubs: { AuthorRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()

    const input = subject.findComponent(AuthorRemoteAutocompleteWithCached)
    expect(input.exists()).toBe(true)
    expect(input.props('extSystem')).toBe(EXT_OWN)
  })

  it('the dialog of an image offers the authors of the DAM under the ext system of that configuration', async () => {
    useExtSystemIdForCached('own').cachedExtSystemId.value = EXT_OWN
    useExtSystemIdForCached('default').cachedExtSystemId.value = EXT_DEFAULT
    useImageMediaWidgetStore().setDetail(imageOfPick())

    const subject = mounted(
      defineComponent({
        setup: () => () =>
          h(UnderOwn, () =>
            h(ImageDetailDialogMetadata, { modelValue: true, saving: false, loading: false, showDamAuthors: true })
          ),
      }),
      { attachTo: document.body, global: { plugins: [pinia], stubs: { AuthorRemoteAutocompleteWithCached: true } } }
    )
    await flushPromises()

    expect(subject.findComponent(AuthorRemoteAutocompleteWithCached).props('extSystem')).toBe(EXT_OWN)
  })

  it("the dialog of a widget looks the names of the authors given meanwhile up under that configuration's", async () => {
    const UNKNOWN_LICENCE = 400004
    own.assets.set('asset-without', damAsset('asset-without', { licence: UNKNOWN_LICENCE }))
    useAssetSelectStore().setSelectConfig([
      { licence: LICENCE_OWN, extSystem: EXT_OWN, licenceName: '', extSystemConfig: {} as never },
    ])
    const Picker = defineComponent({ emits: ['confirm'], setup: () => () => h('div') })
    const MetadataDialog = defineComponent({
      emits: ['confirm'],
      setup: (_, { expose }) => {
        expose({ confirm: () => undefined })
        return () => h('div')
      },
    })
    useExtSystemIdForCached('own').cachedExtSystemId.value = EXT_OWN
    const subject = mounted(ImageWidgetInner, {
      props: {
        modelValue: null,
        queueKey: 'named-dialog-authors',
        uploadLicence: LICENCE_OWN,
        selectLicences: [LICENCE_OWN],
        configName: 'own',
      } as never,
      global: {
        plugins: [pinia],
        provide: {
          [ImageWidgetUploadConfigKey as symbol]: shallowRef({
            licence: LICENCE_OWN,
            extSystem: EXT_OWN,
            licenceName: '',
            extSystemConfig: {},
          }),
        },
        stubs: {
          AAssetSelect: Picker,
          ImageDetailDialogMetadata: MetadataDialog,
          AssetDetailDialog: true,
          UploadQueueDialogSingle: true,
          AFileInput: true,
          AFileInputDialog: true,
          AFileDropzone: true,
        },
      },
    })
    subject.findComponent(Picker).vm.$emit('confirm', {
      type: 'asset',
      value: [
        {
          id: 'asset-without',
          licence: UNKNOWN_LICENCE,
          mainFile: { id: 'file-of-asset-without' },
          attributes: { assetType: DamAssetType.Image },
          podcasts: [],
        },
      ],
    })
    await flushPromises()
    await flushPromises()
    useExtSystemIdForCached('default').cachedExtSystemId.value = EXT_DEFAULT
    own.assets.set(
      'asset-without',
      damAsset('asset-without', { licence: UNKNOWN_LICENCE, authors: ['author-elsewhere'] })
    )

    subject.findComponent(MetadataDialog).vm.$emit('update:damAuthors', ['author-picked'])
    subject.findComponent(MetadataDialog).vm.$emit('confirm')
    await flushPromises()
    await flushPromises()

    expect(askedForNames(own)).toEqual([`GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`])
    expect(dam.requests).toEqual([])
  })
})
