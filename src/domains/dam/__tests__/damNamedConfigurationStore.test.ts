import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, damAsset, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  answerDamConfig,
  type DamConfigOfDam,
  fillDamConfigOf,
  SHARED_FIELD,
} from '@/domains/dam/__tests__/support/namedDamConfig'
import { forgetAlerts, shownAlerts, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import { showMetadataSaveError, updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AssetDistributionServiceNameFilter from '@/domains/dam/assetSelect/components/AssetDistributionServiceNameFilter.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamAuthorAssetTypeConfig } from '@/domains/dam/author/composables/damAuthorConfig'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamConfigStore, useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { useDamKeywordAssetTypeConfig } from '@/domains/dam/keyword/composables/damKeywordConfig'
import AFilterValueObjectOptionsSelect from '@/domains/filters/components/AFilterValueObjectOptionsSelect.vue'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useDamDistributionServiceType } from '@/domains/dam/user/types/DamDistributionServiceType'

// Cases that fill both stores fill `own` first.
// With one store for every name, the last fill would be what both read.

const { endPoints } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const EXT = 4
const LICENCE = 300003
const QUEUE = 'named-store'
const { Processing } = UploadQueueItemStatus

const ofDefault: DamConfigOfDam = {
  extSystem: EXT,
  licence: LICENCE,
  fieldName: 'Headline of default',
  keywords: true,
  authors: true,
  chunk: { minSize: 1048576, maxSize: 52428800 },
  distribution: { title: 'YouTube of default', iconPath: '/default-youtube.svg' },
  externalProvider: 'Provider of default',
}
const ofOwn: DamConfigOfDam = {
  extSystem: EXT,
  licence: LICENCE,
  fieldName: 'Headline of own',
  keywords: false,
  authors: false,
  chunk: { minSize: 2000, maxSize: 8000 },
  distribution: { title: 'YouTube of own', iconPath: '/own-youtube.svg' },
  externalProvider: 'Provider of own',
}

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrappers: VueWrapper[] = []

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: { ...coreDam.configs, own: { damClient: own.client, endPointAsset: OWN.asset, endPointImage: OWN.image } },
  })
  initCommonAdminImageOptions({ ...image, configs: { ...image.configs, own: image.configs.default! } })
  let started = 0
  own.reply((request) => {
    if (request.method !== 'POST' || !own.routes.start.test(request.url)) return undefined
    started++
    const created = { id: `own-file-${started}`, asset: `own-asset-${started}` }
    own.assets.set(
      created.asset,
      damAssetWithFile(created.asset, created.id, AssetFileProcessStatus.Uploading, {
        licence: LICENCE,
        attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.Draft },
      })
    )
    return { status: 201, data: created }
  })
  waits = holdLongWaits()
  socket = stubDamSocket()
  forgetAlerts()
  signInToDam(EXT)
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  useUploadQueuesStore().stopUpload(QUEUE)
  useUploadQueuesStore().stopUpload(QUEUE + '-own')
  waits.restore()
  socket.restore()
  signOutOfDam()
  useDamNotificationsEventBus().reset()
})

const asked = (of: FakeDam) =>
  [...new Set(of.requests.map((request) => `${request.method} ${request.url.split('?')[0]}`))].sort()
const configurationOf = (extSystem: number) =>
  [
    `GET /adm/v1/asset-licence/${LICENCE}`,
    'GET /adm/v1/configuration',
    `GET /adm/v1/configuration/ext-system/${extSystem}`,
    ...['audio', 'document', 'image', 'video'].map(
      (type) => `GET /adm/v1/asset-custom-form/ext-system/${extSystem}/type/${type}/element`
    ),
  ].sort()

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
    'AssetDetailDialog',
    'UploadQueueDialogSingle',
    'UploadQueueDialog',
    'AFormRemoteAutocompleteWithCached',
    'AAssetSelect',
  ].map((name) => [name, true])
)
const mountRoot = async (root: Component, props: Record<string, unknown>) => {
  const wrapper = mount(root, {
    attachTo: document.body,
    props: { queueKey: QUEUE, uploadLicence: LICENCE, selectLicences: [LICENCE], ...props },
    global: { plugins: [pinia], stubs: widgetStandIns },
  })
  wrappers.push(wrapper)
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('.v-progress-circular').exists()).toBe(false))
  await flushPromises()
  return wrapper
}
const widgets: Array<[string, Component, Record<string, unknown>]> = [
  ['AImageWidget', AImageWidget, { modelValue: null }],
  ['AImageWidgetMultiple', AImageWidgetMultiple, { modelValue: [] }],
  ['AImageMediaWidget', AImageMediaWidget, { image: null, media: null }],
]

describe('the DAM configuration store of a name', () => {
  it('is that of useDamConfigStore for default; own has one of its own, and a write into one is not in the other', () => {
    const ofDefaultName = useDamConfigStoreOf('default')
    const ofOwnName = useDamConfigStoreOf('own')

    expect(ofDefaultName).toBe(useDamConfigStore())
    expect(ofDefaultName.$id).toBe('commonAdminDamConfigStore')
    expect(ofOwnName).not.toBe(ofDefaultName)
    expect(ofOwnName.$id.startsWith('commonAdmin')).toBe(true)
    expect(useDamConfigStoreOf('own')).toBe(ofOwnName)

    ofOwnName.damConfigLicenceExtSystem.set(LICENCE, { name: 'own', extSystem: 5 })
    ofDefaultName.damPrvConfig.settings.imageChunkConfig = { minSize: 1, maxSize: 2 }

    expect(ofDefaultName.damConfigLicenceExtSystem.has(LICENCE)).toBe(false)
    expect(ofOwnName.damPrvConfig.settings.imageChunkConfig).toEqual({ minSize: 0, maxSize: 0 })
  })

  it('resolves one licence id to the ext system of each name, each read by its own client into its own store', async () => {
    answerDamConfig(dam, ofDefault)
    answerDamConfig(own, { ...ofOwn, extSystem: 5 })

    const underDefault = await useDamConfigState(dam.client, 'default').getExtSystemByLicence(LICENCE)
    const underOwn = await useDamConfigState(own.client, 'own').getExtSystemByLicence(LICENCE)

    expect([underDefault, underOwn]).toEqual([EXT, 5])
    expect(asked(dam)).toEqual([`GET /adm/v1/asset-licence/${LICENCE}`])
    expect(asked(own)).toEqual([`GET /adm/v1/asset-licence/${LICENCE}`])
    expect(useDamConfigStoreOf('own').damConfigLicenceExtSystem.get(LICENCE)?.extSystem).toBe(5)
    expect(useDamConfigStore().damConfigLicenceExtSystem.get(LICENCE)?.extSystem).toBe(EXT)
  })
})

describe.each(widgets)('the root widget %s under a named configuration', (_name, root, props) => {
  it("loads that configuration's settings, licence, ext system and custom forms with its client, though default's are loaded", async () => {
    fillDamConfigOf('default', ofDefault)
    answerDamConfig(own, ofOwn)

    await mountRoot(root, { ...props, configName: 'own' })

    expect(asked(own)).toEqual(configurationOf(EXT))
    expect(asked(dam)).toEqual([])
    const ownStore = useDamConfigStoreOf('own')
    expect(ownStore.damPrvConfig.settings.imageChunkConfig).toEqual(ofOwn.chunk)
    expect(ownStore.damConfigAssetCustomFormElements.get(EXT)?.image.map((element) => element.name)).toEqual([
      ofOwn.fieldName,
    ])
    expect(useDamConfigStore().damPrvConfig.settings.imageChunkConfig).toEqual(ofDefault.chunk)
    expect(useDamConfigStore().damConfigAssetCustomFormElements.get(EXT)?.image[0]?.name).toBe(ofDefault.fieldName)
  })

  it('loads its own under default after one under own has loaded its own', async () => {
    useDamConfigStore().reset()
    answerDamConfig(dam, ofDefault)
    answerDamConfig(own, ofOwn)

    await mountRoot(root, { ...props, configName: 'own' })
    await mountRoot(root, props)

    expect(asked(own)).toEqual(configurationOf(EXT))
    expect(asked(dam)).toEqual(configurationOf(EXT))
    expect(useDamConfigStore().damPrvConfig.settings.imageChunkConfig).toEqual(ofDefault.chunk)
    expect(useDamConfigStoreOf('own').damPrvConfig.settings.imageChunkConfig).toEqual(ofOwn.chunk)
  })

  it('asks nothing under own when the application has filled its store, and leaves the default store as it was', async () => {
    fillDamConfigOf('default', ofDefault)
    fillDamConfigOf('own', ofOwn)

    await mountRoot(root, { ...props, configName: 'own' })

    expect(asked(own)).toEqual([])
    expect(asked(dam)).toEqual([])
    expect(useDamConfigStore().damConfigAssetCustomFormElements.get(EXT)?.image[0]?.name).toBe(ofDefault.fieldName)
    expect(useDamConfigStore().damConfigExtSystem.get(EXT)?.image?.keywords?.enabled).toBe(true)
  })
})

describe('the chunks of an upload under a named configuration', () => {
  // No upload has left a last size under either name yet. The last size is kept per name for the next upload.
  it('are of the size its store bounds them to, while those of an upload under default are of default', async () => {
    fillDamConfigOf('own', { ...ofOwn, chunk: { minSize: 2000, maxSize: 2000 } })
    fillDamConfigOf('default', ofDefault)
    const store = useUploadQueuesStore()
    const file = () => new File([new Uint8Array(5000)], 'photo.jpg', { type: 'image/jpeg' })

    await store.addByFiles(QUEUE + '-own', EXT, LICENCE, [file()], 'own')
    await store.addByFiles(QUEUE, EXT, LICENCE, [file()], 'default')
    await vi.waitFor(() =>
      expect([QUEUE + '-own', QUEUE].map((queueKey) => store.getQueueItems(queueKey)[0]?.status)).toEqual([
        Processing,
        Processing,
      ])
    )

    expect(own.sentTo('POST', own.routes.chunk)).toHaveLength(3)
    expect(dam.sentTo('POST', dam.routes.chunk)).toHaveLength(1)
  })

  it('are bounded by its store, and do not start from the last size of an upload under default', () => {
    fillDamConfigOf('own', ofOwn)
    fillDamConfigOf('default', ofDefault)
    const underDefault = useDamUploadChunkSize(30, 'default')
    underDefault.updateChunkSize(1_000_000_000)
    expect(underDefault.lastChunkSize.value).toBe(ofDefault.chunk.maxSize)

    const underOwn = useDamUploadChunkSize(30, 'own')
    expect(underOwn.lastChunkSize.value).toBeLessThanOrEqual(ofOwn.chunk.maxSize)
    underOwn.updateChunkSize(1_000_000_000)

    expect(underOwn.lastChunkSize.value).toBe(ofOwn.chunk.maxSize)
    expect(useDamUploadChunkSize(30, 'own').lastChunkSize.value).toBe(ofOwn.chunk.maxSize)
    expect(useDamUploadChunkSize(30, 'default').lastChunkSize.value).toBe(ofDefault.chunk.maxSize)
  })
})

describe('a refused save of metadata under a named configuration', () => {
  it('names its fields by the custom form of that configuration', async () => {
    fillDamConfigOf('own', ofOwn)
    fillDamConfigOf('default', ofDefault)
    own.reply((request) =>
      request.method === 'PATCH' && request.url === `${OWN.asset}/metadata-bulk-update`
        ? {
            status: 422,
            data: {
              contextId: 'context',
              error: 'validation_failed',
              fields: { [`[0].customData.${SHARED_FIELD}`]: ['error_field_invalid'] },
            },
          }
        : undefined
    )

    const refused = await updateAssetMetadata(own.client, OWN.asset, damAsset('own-asset-1'), EXT, false).catch(
      (error: unknown) => error
    )
    showMetadataSaveError(refused, EXT, 'own')

    expect(shownAlerts()).toHaveLength(1)
    expect(shownAlerts()[0]![1]).toContain(ofOwn.fieldName)
    expect(shownAlerts()[0]![1]).not.toContain(ofDefault.fieldName)
    expect(asked(dam)).toEqual([])
  })
})

describe('the filter of distribution services under a named configuration', () => {
  it("loads that configuration's settings with its client, and offers its services", async () => {
    fillDamConfigOf('default', ofDefault)
    answerDamConfig(own, ofOwn)
    const wrapper = mount(AssetDistributionServiceNameFilter, {
      props: { name: 'distributionServices', configName: 'own' },
      global: { plugins: [pinia], stubs: { AFilterValueObjectOptionsSelect: true } },
    })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findComponent(AFilterValueObjectOptionsSelect).exists()).toBe(true))

    expect(wrapper.findComponent(AFilterValueObjectOptionsSelect).props('items')).toEqual([
      { title: ofOwn.distribution.title, value: 'youtube' },
    ])
    expect(asked(own)).toEqual(['GET /adm/v1/configuration'])
    expect(asked(dam)).toEqual([])
  })
})

describe('the public composables of the DAM configuration', () => {
  const read = () => ({
    keywordsOfExtSystem: useDamConfigState().getDamConfigExtSystem(EXT)?.image?.keywords?.enabled,
    keywordsOfType: useDamKeywordAssetTypeConfig(DamAssetType.Image, EXT).keywordEnabled.value,
    authorsOfType: useDamAuthorAssetTypeConfig(DamAssetType.Image, EXT).authorEnabled.value,
    services: useDamDistributionServiceType().allDistributionServiceTypeOptions.value.map((option) => option.title),
    chunk: (() => {
      const sizing = useDamUploadChunkSize()
      sizing.updateChunkSize(1_000_000_000)
      return sizing.lastChunkSize.value
    })(),
  })

  it('read the store of the inherited name when called in the setup of a component under it, else that of default', () => {
    fillDamConfigOf('own', ofOwn)
    fillDamConfigOf('default', ofDefault)
    let inSetup: ReturnType<typeof read> | undefined
    const Reader = defineComponent({
      setup() {
        inSetup = read()
        return () => null
      },
    })
    wrappers.push(
      mount(defineComponent({ setup: () => () => h(UnderOwn, () => h(Reader)) }), { global: { plugins: [pinia] } })
    )

    expect(inSetup).toEqual({
      keywordsOfExtSystem: false,
      keywordsOfType: false,
      authorsOfType: false,
      services: [ofOwn.distribution.title],
      chunk: ofOwn.chunk.maxSize,
    })
    expect(read()).toEqual({
      keywordsOfExtSystem: true,
      keywordsOfType: true,
      authorsOfType: true,
      services: [ofDefault.distribution.title],
      chunk: ofDefault.chunk.maxSize,
    })
  })
})

describe('the metadata of the asset detail under a named configuration', () => {
  it.each(['given the name', 'inside a component under it'])(
    "shows that configuration's custom form, and its switches of keywords and authors: %s",
    async (way) => {
      fillDamConfigOf('own', ofOwn)
      fillDamConfigOf('default', ofDefault)
      useAssetDetailStore().setAsset(damAsset('own-asset-1', { licence: LICENCE }))
      const props = { extSystem: EXT }
      const host =
        way === 'given the name'
          ? defineComponent({ setup: () => () => h(AssetMetadata, { ...props, configName: 'own' }) })
          : defineComponent({ setup: () => () => h(UnderOwn, () => h(AssetMetadata, props)) })
      const wrapper = mount(host, {
        attachTo: document.body,
        global: {
          plugins: [pinia],
          stubs: { KeywordRemoteAutocompleteWithCached: true, AuthorRemoteAutocompleteWithCached: true },
        },
      })
      wrappers.push(wrapper)
      await flushPromises()

      expect(wrapper.text()).toContain(ofOwn.fieldName)
      expect(wrapper.text()).not.toContain(ofDefault.fieldName)
      expect(wrapper.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(false)
      expect(wrapper.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(false)
      expect([...asked(own), ...asked(dam)]).toEqual([])
    }
  )

  it.each(['given the name', 'inside a component under it'])(
    'names the fields of a refused save of the detail by the custom form of that configuration: %s',
    async (way) => {
      fillDamConfigOf('own', ofOwn)
      fillDamConfigOf('default', ofDefault)
      own.reply((request) =>
        request.method === 'PATCH' && request.url === `${OWN.asset}/metadata-bulk-update`
          ? {
              status: 422,
              data: {
                contextId: 'context',
                error: 'validation_failed',
                fields: { [`[0].customData.${SHARED_FIELD}`]: ['error_field_invalid'] },
              },
            }
          : undefined
      )
      useAssetDetailStore().setAsset(
        damAssetWithFile('own-asset-1', 'own-file-1', AssetFileProcessStatus.Processed, { licence: LICENCE })
      )
      const props = { queueKey: QUEUE, isActive: true, assetType: DamAssetType.Image, extSystem: EXT }
      const host =
        way === 'given the name'
          ? defineComponent({ setup: () => () => h(AssetDetailSidebarMetadata, { ...props, configName: 'own' }) })
          : defineComponent({ setup: () => () => h(UnderOwn, () => h(AssetDetailSidebarMetadata, props)) })
      const wrapper = mount(host, {
        global: { plugins: [pinia], stubs: { AssetDetailSidebarActionsWrapper: true, AssetMetadata: true } },
      })
      wrappers.push(wrapper)

      const sidebar = wrapper.findComponent(AssetDetailSidebarMetadata)
      await (sidebar.vm as unknown as { $: { setupState: { onSave: () => Promise<void> } } }).$.setupState.onSave()
      await flushPromises()

      expect(asked(own)).toEqual([`PATCH ${OWN.asset}/metadata-bulk-update`])
      expect(asked(dam)).toEqual([])
      expect(shownAlerts()).toHaveLength(1)
      expect(shownAlerts()[0]![1]).toContain(ofOwn.fieldName)
      expect(shownAlerts()[0]![1]).not.toContain(ofDefault.fieldName)
    }
  )
})

describe('the filter of distribution services under a configuration the application has not got', () => {
  it('is refused before any DAM configuration store is made for that name', () => {
    expect(() =>
      mount(AssetDistributionServiceNameFilter, {
        props: { name: 'distributionServices', configName: 'unknown' },
        global: { plugins: [pinia], stubs: { AFilterValueObjectOptionsSelect: true } },
      })
    ).toThrow("Composable can't be used without properly configured common admin.")

    expect(Object.keys(pinia.state.value).filter((id) => id.startsWith('commonAdminDamConfigStore:'))).toEqual([])
    expect([...asked(own), ...asked(dam)]).toEqual([])
  })
})
