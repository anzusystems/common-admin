import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, reactive } from 'vue'
import { VSelect } from 'vuetify/components'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import {
  type DamConfigOfDam,
  fillDamConfigOf,
  SHARED_PROVIDER,
  SHARED_SERVICE,
} from '@/domains/dam/__tests__/support/namedDamConfig'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import AssetImageMetaIcons from '@/domains/dam/assetDetail/components/AssetImageMetaIcons.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import AssetQueueSelectedSidebar from '@/domains/dam/uploadQueue/components/AssetQueueSelectedSidebar.vue'
import type { UploadQueueMassOperationsBinding } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import UploadQueueDialogSingleSidebarMetadataContent from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebarMetadataContent.vue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import DamDistributionServiceSelect from '@/domains/dam/user/components/DamDistributionServiceSelect.vue'
import DamExternalProviderAssetSelect from '@/domains/dam/user/components/DamExternalProviderAssetSelect.vue'

// Components that read the DAM configuration store under a named
// configuration, given as `configName` or by a parent component.
// The store of `own` differs from `default` in ext system 4's custom form, keywords, distribution service and provider.
// `own` is filled first. With one store for every name, both would read the last fill, `default`'s.

const { endPoints } = cmsConfiguration
const CONTENT_QUEUE = 'named-content'
const EXT = 4
const LICENCE = 300003
const common = { extSystem: EXT, licence: LICENCE, chunk: { minSize: 1000, maxSize: 2000 } }
const ofDefault: DamConfigOfDam = {
  ...common,
  fieldName: 'Headline of default',
  keywords: true,
  authors: true,
  distribution: { title: 'YouTube of default', iconPath: '/default-youtube.svg' },
  externalProvider: 'Provider of default',
}
const ofOwn: DamConfigOfDam = {
  ...common,
  fieldName: 'Headline of own',
  keywords: false,
  authors: false,
  distribution: { title: 'YouTube of own', iconPath: '/own-youtube.svg' },
  externalProvider: 'Provider of own',
}

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam({ asset: '/own/v2/asset', image: '/own/v2/image' })
  const { coreDam } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({ ...coreDam, configs: { ...coreDam.configs, own: { damClient: own.client } } })
  fillDamConfigOf('own', ofOwn)
  fillDamConfigOf('default', ofDefault)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  useUploadQueuesStore().stopUpload(CONTENT_QUEUE)
})

const UnderOwn = defineComponent({
  setup(_, { slots }) {
    useDamConfigName('own')

    return () => slots.default?.()
  },
})
const ways = ['given the name', 'inside a component under it'] as const
type Way = (typeof ways)[number]
const mountUnderOwn = async (way: Way, component: Component, props: Record<string, unknown>) => {
  const host =
    way === 'given the name'
      ? defineComponent({ setup: () => () => h(component, { ...props, configName: 'own' }) })
      : defineComponent({ setup: () => () => h(UnderOwn, () => h(component, props)) })
  wrapper = mount(host, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      stubs: {
        KeywordRemoteAutocompleteWithCached: true,
        AuthorRemoteAutocompleteWithCached: true,
        AssetImage: true,
      },
    },
  })
  await flushPromises()

  return wrapper
}
const askedNothing = () => {
  expect(own.requests).toEqual([])
  expect(dam.requests).toEqual([])
}

describe.each(ways)('an exported component under a named DAM configuration, %s', (way) => {
  it('ADamAssetCustomMetadataForm shows the custom form of that configuration', async () => {
    const subject = await mountUnderOwn(way, AssetCustomMetadataForm, {
      assetType: DamAssetType.Image,
      extSystem: EXT,
      modelValue: {},
    })

    expect(subject.text()).toContain(ofOwn.fieldName)
    expect(subject.text()).not.toContain(ofDefault.fieldName)
    askedNothing()
  })

  it('ADamUploadQueueItem has its custom form and neither keywords nor authors, as that configuration says', async () => {
    const item = reactive(
      useUploadQueueItemFactory().createDefault(
        'row',
        UploadQueueItemType.File,
        UploadQueueItemStatus.Uploaded,
        DamAssetType.Image,
        1,
        LICENCE
      )
    ) as UploadQueueItem
    item.assetId = 'asset-1'
    item.fileId = 'file-1'
    item.canEditMetadata = true

    const subject = await mountUnderOwn(way, UploadQueueItemEditable, {
      index: 0,
      queueKey: 'named-row',
      extSystem: EXT,
      customData: item.customData,
      keywords: item.keywords,
      authors: item.authors,
      item,
      refreshDisabled: false,
      mainFileSingleUse: item.mainFileSingleUse,
    })

    expect(subject.text()).toContain(ofOwn.fieldName)
    expect(subject.text()).not.toContain(ofDefault.fieldName)
    expect(subject.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(false)
    expect(subject.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(false)
    askedNothing()
  })

  it('ADamUploadQueueMassOperations offers the custom form and neither keywords nor authors of that configuration', async () => {
    const operations: UploadQueueMassOperationsBinding = {
      assetTypes: () => [DamAssetType.Image],
      fillCustomDataValue: () => undefined,
      fillKeywords: () => undefined,
      fillAuthors: () => undefined,
    }

    const subject = await mountUnderOwn(way, AssetQueueSelectedSidebar, {
      queueKey: 'named-mass',
      extSystem: EXT,
      operations,
    })

    expect(subject.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(false)
    expect(subject.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(false)
    expect(subject.text()).toContain(ofOwn.fieldName)
    expect(subject.text()).not.toContain(ofDefault.fieldName)
    askedNothing()
  })

  it('ADamAssetImageMetaIcons draws the distribution service of that configuration', async () => {
    const subject = await mountUnderOwn(way, AssetImageMetaIcons, {
      assetType: DamAssetType.Image,
      assetFileProperties: {
        distributesInServices: [SHARED_SERVICE],
        slotNames: [],
        fromRss: false,
        width: 1600,
        height: 900,
      },
    })

    expect(subject.findAll('img').map((icon) => [icon.attributes('src'), icon.attributes('title')])).toEqual([
      [ofOwn.distribution.iconPath, ofOwn.distribution.title],
    ])
    askedNothing()
  })

  it.each<[string, Component, string]>([
    ['ADamDistributionServiceSelect', DamDistributionServiceSelect, SHARED_SERVICE],
    ['ADamExternalProviderAssetSelect', DamExternalProviderAssetSelect, SHARED_PROVIDER],
  ])('%s offers what that configuration has', async (_name, select, value) => {
    const subject = await mountUnderOwn(way, select, { modelValue: [], client: own.client })

    const title = select === DamDistributionServiceSelect ? ofOwn.distribution.title : ofOwn.externalProvider
    expect(subject.findComponent(VSelect).props('items')).toEqual([{ value, title }])
    askedNothing()
  })
})

// The form of the dialog of one uploaded file uses the rules of
// its own `configName`, not the name of the component above it.
describe('the form of the dialog of one uploaded file, given the name of a DAM configuration', () => {
  it('has neither keywords nor authors, as that configuration says', async () => {
    await useUploadQueuesStore().addByCopyToLicence(CONTENT_QUEUE, EXT, LICENCE, ['asset-1'], 'own')
    wrapper = mount(UploadQueueDialogSingleSidebarMetadataContent, {
      attachTo: document.body,
      props: { queueKey: CONTENT_QUEUE, extSystem: EXT, configName: 'own' },
      global: {
        plugins: [pinia],
        stubs: {
          KeywordRemoteAutocompleteWithCached: true,
          AuthorRemoteAutocompleteWithCached: true,
          AssetFileInfoPanel: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain(ofOwn.fieldName)
    expect(wrapper.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(false)
    expect(wrapper.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(false)
    askedNothing()
  })
})
