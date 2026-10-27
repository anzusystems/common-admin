import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import type { CommonAdminCoreDamConfig } from '@/AnzuSystemsCommonAdmin'
import { usePagination } from '@/domains/api/composables/pagination'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAsset,
  damAssetWithFile,
  type FakeDam,
  type FakeDamRequest,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, signInToDam, signOutOfDam } from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import AssetSelectListTable from '@/domains/dam/assetSelect/components/AssetSelectListTable.vue'
import AssetSelectListTiles from '@/domains/dam/assetSelect/components/AssetSelectListTiles.vue'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorCreateButton from '@/domains/dam/author/components/AuthorCreateButton.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import DamAuthorFilterRemoteAutocomplete from '@/domains/dam/author/components/DamAuthorFilterRemoteAutocomplete.vue'
import { useAuthorSelectActions } from '@/domains/dam/author/composables/authorActions'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore, useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import DamKeywordFilterRemoteAutocomplete from '@/domains/dam/keyword/components/DamKeywordFilterRemoteAutocomplete.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { useKeywordSelectActions } from '@/domains/dam/keyword/composables/keywordActions'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'

// The caches of names ask 1.5 s after they are given an id, often during the next case.
// That wait is held and let pass only once a case is over. So no cache asks
// during a case, and each client's recorded requests are all it was asked.

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const OWN_AUTHOR = '/own/v2/author'
const OWN_KEYWORD = '/own/v2/keyword'
const QUEUE = 'named-components'
const NAMES = /\/(author|keyword|user)(\/|$)/
/**
 * Waits from this length are held. The caches wait 1.5 s before they ask for names.
 */
const HELD_FROM_MS = 1_200
const { Processing, Uploaded } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const answerNames = (of: FakeDam) =>
  of.reply((request) => {
    if (!NAMES.test(request.url.split('?')[0]!)) return undefined
    if (request.method === 'POST')
      return { status: 201, data: { id: 'created', ...JSON.parse(request.data as string) } }
    return { status: 200, data: { data: [], totalCount: 0 } }
  })

const configure = (ofOwn: Partial<CommonAdminCoreDamConfig> = {}) => {
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam,
    configs: {
      ...coreDam.configs,
      own: {
        damClient: own.client,
        endPointAsset: OWN.asset,
        endPointImage: OWN.image,
        endPointAuthor: OWN_AUTHOR,
        endPointKeyword: OWN_KEYWORD,
        ...ofOwn,
      },
    },
  })
  initCommonAdminImageOptions({ ...image, configs: { ...image.configs, own: image.configs.default! } })
  // Only the chunks differ from `default`: half a photo, where `default` takes a photo whole.
  // An upload under `own` that read the store of `default` would send each photo in one chunk.
  seedDamConfigOf('own', pinia).damPrvConfig.settings.imageChunkConfig = { minSize: 1500, maxSize: 1500 }
  useExtSystemIdForCached('own').cachedExtSystemId.value = extSystem
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  answerNames(dam)
  answerNames(own)
  let started = 0
  own.reply((request) => {
    if (request.method !== 'POST' || !own.routes.start.test(request.url)) return undefined
    started++
    const created = { id: `own-file-${started}`, asset: `own-asset-${started}` }
    own.assets.set(
      created.asset,
      damAssetWithFile(created.asset, created.id, AssetFileProcessStatus.Uploading, {
        licence,
        attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.Draft },
      })
    )
    return { status: 201, data: created }
  })
  waits = holdLongWaits(HELD_FROM_MS)
  socket = stubDamSocket()
  configure()
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  useUploadQueueDialog().uploadQueueDialog.value = null
  useUploadQueuesStore().stopUpload(QUEUE)
  // Let the caches ask for what the case gave them now, with the clients of this case.
  await waits.elapseAll()
  waits.restore()
  socket.restore()
  signOutOfDam()
  useDamNotificationsEventBus().reset()
})

const asked = (of: FakeDam) => of.requests.map((request) => `${request.method} ${request.url.split('?')[0]}`)
const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const sendingUnderOwn = [
  `POST ${OWN.image}/licence/${licence}`,
  `POST ${OWN.image}/own-file-1/chunk`,
  `POST ${OWN.image}/own-file-1/chunk`,
  `PATCH ${OWN.image}/own-file-1/uploaded`,
]

const fields = [{ name: 'text', default: '' }] as const satisfies readonly MakeFilterOption<string>[]
const listArguments = () => {
  const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
    system: 'dam',
    subject: 'author',
  })
  return [usePagination('id').pagination, filterData, filterConfig] as const
}

const UnderOwn = defineComponent({
  setup(_, { slots }) {
    useDamConfigName('own')

    return () => slots.default?.()
  },
})
const ways = ['given the name', 'inside a component under it'] as const
type Way = (typeof ways)[number]
const mountUnderOwn = (
  way: Way,
  component: Component,
  props: Record<string, unknown>,
  global: Record<string, unknown> = {}
) => {
  const host =
    way === 'given the name'
      ? defineComponent({ setup: () => () => h(component, { ...props, configName: 'own' }) })
      : defineComponent({ setup: () => () => h(UnderOwn, () => h(component, props)) })
  wrapper = mount(host, { attachTo: document.body, global: { plugins: [pinia], ...global } })

  return wrapper.findComponent(component)
}

const Input = defineComponent({
  name: 'NameInputStandIn',
  props: { fetchItemsMinimal: { type: Function, default: undefined } },
  emits: ['update:search'],
  setup(_, { slots }) {
    return () => h('div', { class: 'name-input' }, slots['append-item']?.())
  },
})
const FilterInput = defineComponent({
  name: 'NameFilterStandIn',
  props: {
    fetchItems: { type: Function, default: undefined },
    fetchItemsMinimal: { type: Function, default: undefined },
  },
  setup: () => () => h('div'),
})
const nameStubs = {
  stubs: {
    AFormRemoteAutocompleteWithCached: Input,
    AFilterRemoteAutocompleteWithMinimal: FilterInput,
    AFilterRemoteAutocomplete: FilterInput,
  },
}
type Search = (...list: ReturnType<typeof listArguments>) => Promise<unknown>

describe('the names of authors and keywords, under a named DAM configuration', () => {
  it('are searched for and looked up at its addresses, by its client', async () => {
    const authors = useAuthorSelectActions(extSystem, 'own')
    const keywords = useKeywordSelectActions(extSystem, 'own')

    await authors.fetchItemsMinimal(...listArguments())
    await authors.fetchItemsByIds(['author-1'])
    await keywords.fetchItemsMinimal(...listArguments())
    await keywords.fetchItemsByIds(['keyword-1'])

    expect(asked(own)).toEqual([
      `GET ${OWN_AUTHOR}/ext-system/${extSystem}`,
      `GET ${OWN_AUTHOR}/ext-system/${extSystem}/search`,
      `GET ${OWN_KEYWORD}/ext-system/${extSystem}`,
      `GET ${OWN_KEYWORD}/ext-system/${extSystem}/search`,
    ])
    expect(asked(dam)).toEqual([])
  })

  it('are looked up there by the mass operation of the image widget that fills the authors', async () => {
    await useImageMassOperations('own').replaceEmptyAuthors(['author-1'])

    expect(asked(own)).toEqual([`GET ${OWN_AUTHOR}/ext-system/${extSystem}/search`])
    expect(asked(dam)).toEqual([])
  })

  describe.each(ways)('by a component %s', (way) => {
    it.each<[string, Component, string]>([
      ['keywords', KeywordRemoteAutocompleteWithCached, OWN_KEYWORD],
      ['authors', AuthorRemoteAutocompleteWithCached, OWN_AUTHOR],
    ])('the input of %s searches there', async (_which, input, address) => {
      const subject = mountUnderOwn(way, input, { modelValue: [], extSystem, multiple: true }, nameStubs)
      await flushPromises()

      await (subject.findComponent(Input).props('fetchItemsMinimal') as Search)(...listArguments())

      expect(asked(own)).toEqual([`GET ${address}/ext-system/${extSystem}`])
      expect(asked(dam)).toEqual([])
    })

    it.each<[string, Component, 'fetchItems' | 'fetchItemsMinimal', string]>([
      ['keywords', DamKeywordFilterRemoteAutocomplete, 'fetchItems', OWN_KEYWORD],
      ['authors', DamAuthorFilterRemoteAutocomplete, 'fetchItemsMinimal', OWN_AUTHOR],
    ])('the filter of %s searches there', async (_which, filter, search, address) => {
      const subject = mountUnderOwn(way, filter, { name: 'names', extSystem }, nameStubs)
      await flushPromises()

      await (subject.findComponent(FilterInput).props(search) as Search)(...listArguments())

      expect(asked(own)).toEqual([`GET ${address}/ext-system/${extSystem}`])
      expect(asked(dam)).toEqual([])
    })

    it('the input of keywords makes a keyword that is typed and entered there', async () => {
      const subject = mountUnderOwn(
        way,
        KeywordRemoteAutocompleteWithCached,
        { modelValue: [], extSystem, multiple: true },
        nameStubs
      )
      subject.findComponent(Input).vm.$emit('update:search', 'new keyword')
      await flushPromises()

      await subject.find('.name-input').trigger('keyup', { key: 'Enter' })
      await vi.waitFor(() => expect(subject.emitted('update:modelValue')).toHaveLength(1))

      expect(asked(own)).toEqual([`POST ${OWN_KEYWORD}`])
      expect(own.body(own.requests[0]!)).toMatchObject({ name: 'new keyword', extSystem })
      expect(asked(dam)).toEqual([])
    })

    it('the button that adds an author makes the author there', async () => {
      const subject = mountUnderOwn(way, AuthorCreateButton, { extSystem, initialValue: 'New Author' })
      await subject.find('button').trigger('click')
      await flushPromises()

      document.body.querySelector<HTMLElement>('[data-cy="button-confirm"]')!.click()
      await vi.waitFor(() => expect(subject.emitted('success')).toHaveLength(1))

      expect(asked(own)).toEqual([`POST ${OWN_AUTHOR}`])
      expect(own.body(own.requests[0]!)).toMatchObject({ name: 'New Author', extSystem })
      expect(asked(dam)).toEqual([])
    })
  })

  describe('made new behind the grant the configuration names', () => {
    beforeEach(() => {
      configure({ keywordCreateAcl: 'dam_keyword_create', authorCreateAcl: 'dam_author_create' })
      signInToDam(extSystem, ['dam_keyword_read', 'dam_author_read'])
    })
    const typed = async (subject: VueWrapper, text: string) => {
      subject.findComponent(Input).vm.$emit('update:search', text)
      await flushPromises()
      await subject.find('.name-input').trigger('keyup', { key: 'Enter' })
      await flushPromises()
    }
    const inputProps = { modelValue: [], extSystem, multiple: true }

    it.each(ways)('a keyword is not offered, and Enter makes none, to a user without it: %s', async (way) => {
      const subject = mountUnderOwn(way, KeywordRemoteAutocompleteWithCached, inputProps, nameStubs)

      await typed(subject as unknown as VueWrapper, 'new keyword')

      expect(subject.find('.a-keywords-append-item').exists()).toBe(false)
      expect([...asked(own), ...asked(dam)]).toEqual([])
    })

    it.each(ways)('an author is not offered to a user without it: %s', async (way) => {
      const subject = mountUnderOwn(way, AuthorRemoteAutocompleteWithCached, inputProps, nameStubs)

      await typed(subject as unknown as VueWrapper, 'New Author')

      expect(subject.findComponent(AuthorCreateButton).exists()).toBe(false)
      expect(subject.find('.a-authors-append-item').exists()).toBe(false)
    })

    it.each(ways)('a keyword is offered, and Enter makes it there, to a user with it: %s', async (way) => {
      signInToDam(extSystem, ['dam_keyword_create'])
      const subject = mountUnderOwn(way, KeywordRemoteAutocompleteWithCached, inputProps, nameStubs)

      subject.findComponent(Input).vm.$emit('update:search', 'new keyword')
      await flushPromises()
      expect(subject.find('.a-keywords-append-item').exists()).toBe(true)
      await subject.find('.name-input').trigger('keyup', { key: 'Enter' })

      await vi.waitFor(() => expect(asked(own)).toEqual([`POST ${OWN_KEYWORD}`]))
      expect(asked(dam)).toEqual([])
    })

    it.each(ways)('an author is offered to a user with it: %s', async (way) => {
      signInToDam(extSystem, ['dam_author_create'])
      const subject = mountUnderOwn(way, AuthorRemoteAutocompleteWithCached, inputProps, nameStubs)

      await typed(subject as unknown as VueWrapper, 'New Author')

      expect(subject.findComponent(AuthorCreateButton).exists()).toBe(true)
      expect(subject.find('.a-authors-append-item').exists()).toBe(true)
    })

    it('both are offered to the user without it under the default configuration, which names no grant', async () => {
      wrapper = mount(
        defineComponent({
          setup: () => () => [
            h(KeywordRemoteAutocompleteWithCached, inputProps),
            h(AuthorRemoteAutocompleteWithCached, inputProps),
          ],
        }),
        { attachTo: document.body, global: { plugins: [pinia], ...nameStubs } }
      )
      wrapper.findAllComponents(Input).forEach((input) => input.vm.$emit('update:search', 'a new name'))
      await flushPromises()

      expect(wrapper.find('.a-keywords-append-item').exists()).toBe(true)
      expect(wrapper.find('.a-authors-append-item').exists()).toBe(true)
      expect(wrapper.findComponent(AuthorCreateButton).exists()).toBe(true)
    })
  })
})

describe('the asset select, under a named DAM configuration', () => {
  beforeEach(() => {
    const select = useAssetSelectStore()
    select.setSelectConfig([{ licence, extSystem, licenceName: '', extSystemConfig: {} as never }])
    select.setAssetType(DamAssetType.Image)
    own.assets.set('own-asset-7', damAsset('own-asset-7', { licence }))
  })

  it('lists the assets and reads the one clicked at its addresses, by its client', async () => {
    let actions!: ReturnType<typeof useAssetSelectActions>
    wrapper = mount(defineComponent({ setup: () => ((actions = useAssetSelectActions('own')), () => h('div')) }), {
      global: { plugins: [pinia] },
    })

    await actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(asked(own)).toHaveLength(1))
    expect(asked(own)[0]).toMatch(new RegExp(`^GET ${OWN.asset}/licence/${licence}`))

    useAssetSelectStore().setList([damAsset('own-asset-7', { licence })] as never)
    await actions.onItemClick({ assetId: 'own-asset-7', index: 0 }, extSystem)

    expect(asked(own)[1]).toBe(`GET ${OWN.asset}/own-asset-7`)
    expect(useAssetDetailStore().asset?.id).toBe('own-asset-7')
    expect(asked(dam)).toEqual([])
  })

  it.each<[string, Component, string]>([
    ['of tiles', AssetSelectListTiles, 'AssetSelectTilesItem'],
    ['in a table', AssetSelectListTable, 'AssetSelectTableRowItem'],
  ])('reads the asset clicked in its list %s there, the list being inside a select under it', async (_, list, row) => {
    useAssetSelectStore().setList([damAsset('own-asset-7', { licence })] as never)
    const subject = mountUnderOwn('inside a component under it', list, { extSystem }, { stubs: { [row]: true } })

    subject.findComponent({ name: row }).vm.$emit('itemClick', { assetId: 'own-asset-7', index: 0 })
    await vi.waitFor(() => expect(useAssetDetailStore().asset?.id).toBe('own-asset-7'))

    expect(asked(own)).toEqual([`GET ${OWN.asset}/own-asset-7`])
    expect(asked(dam)).toEqual([])
  })
})

describe('the list of assets of a page, given the name of a DAM configuration', () => {
  const isListRequest = (request: FakeDamRequest) =>
    request.method === 'GET' && request.url.startsWith(`${OWN.asset}/licence/${licence}/search?`)
  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  const mountList = async (slots: Record<string, (props: never) => unknown> = {}) => {
    own.reply((request) =>
      isListRequest(request)
        ? { status: 200, data: { data: [damAsset('own-asset-7', { licence })], totalCount: 1 } }
        : undefined
    )
    own.assets.set('own-asset-7', damAsset('own-asset-7', { licence }))
    wrapper = mount(AAssetListInner, {
      attachTo: document.body,
      props: {
        assetType: DamAssetType.Image,
        queueKey: QUEUE,
        selectConfigs: [uploadConfig()],
        skipCurrentUserCheck: true,
        configName: 'own',
      },
      slots: slots as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: Object.fromEntries(
          [
            'AssetSelectListBar',
            'AssetSelectTilesItem',
            'AssetSelectTableRowItem',
            'AssetMetadata',
            'AssetDetailDialog',
            'UploadQueueDialog',
            'AFilterString',
            'AFilterBooleanSelect',
            'AFilterTimeInterval',
            'DamKeywordFilterRemoteAutocomplete',
            'DamAuthorFilterRemoteAutocomplete',
            'DamUserFilterRemoteAutocomplete',
          ].map((name) => [name, true])
        ),
      },
    })
    await vi.waitFor(() => expect(own.requests.filter(isListRequest)).toHaveLength(1))
    await vi.waitFor(() => expect(useAssetSelectStore().loader).toBe(false))
  }

  it('lists its assets, and reads the one clicked in its list, at the addresses of that configuration', async () => {
    await mountList()
    const rows = [
      ...wrapper!.findAllComponents({ name: 'AssetSelectTilesItem' }),
      ...wrapper!.findAllComponents({ name: 'AssetSelectTableRowItem' }),
    ]
    expect(rows).toHaveLength(1)

    rows[0]!.vm.$emit('itemClick', { assetId: 'own-asset-7', index: 0 })
    await vi.waitFor(() => expect(useAssetDetailStore().asset?.id).toBe('own-asset-7'))

    expect(asked(own)).toEqual([`GET ${OWN.asset}/licence/${licence}/search`, `GET ${OWN.asset}/own-asset-7`])
    expect(own.unanswered).toEqual([])
    expect(asked(dam)).toEqual([])
  })

  it('sends the files picked on its page there', async () => {
    let pick!: (files: File[]) => void
    await mountList({
      'upload-activator': (slotProps: never) => {
        pick = (slotProps as { onFileInput: (files: File[]) => void }).onFileInput
        return h('button', { class: 'upload-of-the-page' })
      },
    })
    const before = asked(own).length

    pick([photo('photo.jpg')])
    const store = useUploadQueuesStore()
    await vi.waitFor(() => expect(store.getQueueItems(QUEUE)[0]?.status).toBe(Processing))

    expect(asked(own).slice(before)).toEqual(sendingUnderOwn)
    expect(asked(dam)).toEqual([])
  })
})

describe.each<[string, Component, Record<string, unknown>]>([
  ['the asset select', AAssetSelect, { assetType: DamAssetType.Image }],
  ['the asset and media select', AAssetSelectMedia, { preselectAssetType: DamAssetType.Image }],
])('%s, given the name of a DAM configuration and opened', (_name, select, props) => {
  const LICENCE = `/adm/v1/asset-licence/${licence}`
  const isListRequest = (request: FakeDamRequest) =>
    request.method === 'GET' && request.url.startsWith(`${OWN.asset}/licence/${licence}/search?`)

  it('reads its licence, lists its assets and reads the one clicked by the client of that configuration', async () => {
    useDamConfigStoreOf('own', pinia).damConfigLicenceExtSystem.delete(licence)
    own.reply((request) => {
      if (request.method === 'GET' && request.url === LICENCE) {
        return { status: 200, data: { id: licence, name: 'own', extSystem } }
      }
      return isListRequest(request)
        ? { status: 200, data: { data: [damAsset('own-asset-7', { licence })], totalCount: 1 } }
        : undefined
    })
    own.assets.set('own-asset-7', damAsset('own-asset-7', { licence }))
    wrapper = mount(select, {
      attachTo: document.body,
      props: {
        minCount: 1,
        maxCount: 1,
        selectLicences: [licence],
        skipCurrentUserCheck: true,
        configName: 'own',
        ...props,
      } as never,
      global: {
        plugins: [pinia],
        stubs: Object.fromEntries(
          [
            'AssetSelectListBar',
            'AssetSelectTilesItem',
            'AssetSelectTableRowItem',
            'AssetMetadata',
            'AFilterString',
            'AFilterBooleanSelect',
            'AFilterTimeInterval',
            'DamKeywordFilterRemoteAutocomplete',
            'DamAuthorFilterRemoteAutocomplete',
            'DamUserFilterRemoteAutocomplete',
          ].map((name) => [name, true])
        ),
      },
    })
    await vi.waitFor(() => expect(wrapper!.findComponent({ name: 'VDialog' }).exists()).toBe(true))
    expect(asked(own)).toEqual([`GET ${LICENCE}`])

    ;(wrapper.vm as unknown as { open: () => void }).open()
    await vi.waitFor(() => expect(own.requests.filter(isListRequest)).toHaveLength(1))
    await vi.waitFor(() => expect(useAssetSelectStore().loader).toBe(false))
    const rows = [
      ...wrapper.findAllComponents({ name: 'AssetSelectTilesItem' }),
      ...wrapper.findAllComponents({ name: 'AssetSelectTableRowItem' }),
    ]
    expect(rows).toHaveLength(1)
    rows[0]!.vm.$emit('itemClick', { assetId: 'own-asset-7', index: 0 })
    await vi.waitFor(() => expect(useAssetDetailStore().asset?.id).toBe('own-asset-7'))

    expect(asked(own)).toEqual([
      `GET ${LICENCE}`,
      `GET ${OWN.asset}/licence/${licence}/search`,
      `GET ${OWN.asset}/own-asset-7`,
    ])
    expect(own.unanswered).toEqual([])
    expect(asked(dam)).toEqual([])
  })
})

const uploadedUnderOwn = async () => {
  const store = useUploadQueuesStore()
  await store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], 'own')
  const [item] = store.getQueueItems(QUEUE)
  await vi.waitFor(() => expect(item.status).toBe(Processing))
  return { store, item }
}

describe('the detail of an asset, under a named DAM configuration', () => {
  it.each(ways)('is saved, and read back into the rows of its asset, at its addresses: %s', async (way) => {
    const { item } = await uploadedUnderOwn()
    const saved = own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed, {
      metadata: { customData: { title: 'saved in the detail' }, authorSuggestions: {}, keywordSuggestions: {} },
    })
    const detail = useAssetDetailStore()
    detail.setAsset(structuredClone(saved))
    detail.updateUploadStore = true
    const subject = mountUnderOwn(
      way,
      AssetDetailSidebarMetadata,
      { queueKey: QUEUE, isActive: true, assetType: DamAssetType.Image, extSystem },
      { stubs: { AssetDetailSidebarActionsWrapper: true, AssetMetadata: true } }
    )

    await (subject.vm as unknown as { $: { setupState: { onSave: () => Promise<void> } } }).$.setupState.onSave()
    await flushPromises()

    expect(asked(own).slice(sendingUnderOwn.length)).toEqual([
      `PATCH ${OWN.asset}/metadata-bulk-update`,
      `GET ${OWN.asset}/own-asset-1`,
    ])
    expect(asked(dam)).toEqual([])
    expect(item.customData).toEqual({ title: 'saved in the detail' })
  })
})

describe('an upload, under a named DAM configuration', () => {
  const Picker = defineComponent({ emits: ['confirm'], setup: () => () => h('div') })
  const ABOUT_PICKED = '/adm/v1/cms/asset/'
  const widgets: Array<[string, Component, Record<string, unknown>]> = [
    ['the image widget', ImageWidgetInner, { modelValue: null }],
    ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
    ['the widget of several images', ImageWidgetMultipleInner, { modelValue: [] }],
  ]
  const mountWidget = (widget: Component, props: Record<string, unknown>) => {
    wrapper = mount(widget, {
      attachTo: document.body,
      props: {
        queueKey: QUEUE,
        uploadLicence: licence,
        selectLicences: [licence],
        configName: 'own',
        ...props,
      } as never,
      global: {
        plugins: [pinia],
        provide: {
          [ImageWidgetUploadConfigKey as symbol]: shallowRef({
            licence,
            extSystem,
            licenceName: '',
            extSystemConfig: {},
          }),
        },
        stubs: {
          AAssetSelect: Picker,
          AAssetSelectMedia: Picker,
          ImageDetailDialogMetadata: true,
          ASortableListEditor: true,
          AssetDetailDialog: true,
          UploadQueueDialog: true,
          UploadQueueDialogSingle: true,
          AFileInput: true,
          AFileInputDialog: true,
          AFileDropzone: true,
        },
      },
    })
    return wrapper
  }

  it.each(widgets)('%s sends a dropped file to its addresses, by its client', async (_name, widget, props) => {
    mountWidget(widget, props)
    await flushPromises()
    const before = asked(own).length

    wrapper!.findComponent({ name: 'AFileDropzone' }).vm.$emit('drop', [photo('photo.jpg')])
    const store = useUploadQueuesStore()
    await vi.waitFor(() => expect(store.getQueueItems(QUEUE)[0]?.status).toBe(Processing))

    expect(asked(own).slice(before)).toEqual(sendingUnderOwn)
    expect(asked(dam)).toEqual([])
  })

  it.each(widgets)('%s has a picked asset copied, and asks about the copy, there', async (_name, widget, props) => {
    own.reply((request) =>
      request.method === 'PATCH' && request.url === `${OWN.image}/copy-to-licence`
        ? {
            status: 200,
            data: [
              {
                asset: 'picked',
                targetAsset: 'own-asset-copy',
                targetMainFile: 'own-file-copy',
                targetAssetLicence: licence,
                result: 'copy',
                assetConflicts: [],
              },
            ],
          }
        : undefined
    )
    own.assets.set(
      'own-asset-copy',
      damAssetWithFile('own-asset-copy', 'own-file-copy', AssetFileProcessStatus.Processed, { licence })
    )
    own.reply((request) =>
      request.method === 'GET' && request.url.startsWith(ABOUT_PICKED) ? { status: 200, data: {} } : undefined
    )
    mountWidget(widget, { ...props, selectLicences: [1, licence] })
    await flushPromises()
    const before = asked(own).length

    wrapper!.findComponent(Picker).vm.$emit('confirm', {
      type: 'asset',
      copyToLicence: licence,
      value: [
        {
          id: 'picked',
          licence: 1,
          mainFile: { id: 'file-of-picked' },
          attributes: { assetType: DamAssetType.Image },
          podcasts: [],
        },
      ],
    })
    const store = useUploadQueuesStore()
    await vi.waitFor(() => expect(store.getQueueItems(QUEUE)).toHaveLength(1))
    await waits.elapse()
    await vi.waitFor(() => expect(store.getQueueItems(QUEUE)[0]!.status).toBe(Uploaded))

    expect(
      asked(own)
        .slice(before)
        .filter((request) => !request.includes(ABOUT_PICKED))
    ).toEqual([`PATCH ${OWN.image}/copy-to-licence`, `GET ${OWN.asset}/own-asset-copy`])
    expect(asked(dam)).toEqual([])
  })

  describe.each(ways)('the dialogs of an upload, %s', (way) => {
    const dialogProps = {
      queueKey: QUEUE,
      licenceId: licence,
      fileInputKey: 0,
      extSystem,
      accept: undefined,
      maxSizes: undefined,
    }
    const uploaded = async (mountDialog: () => VueWrapper) => {
      own.reply((request) =>
        request.method === 'GET' && request.url.startsWith(`${OWN_AUTHOR}/ext-system/${extSystem}/search`)
          ? { status: 200, data: { data: [{ id: 'author-1', name: 'Own Author' }], totalCount: 1 } }
          : undefined
      )
      const store = useUploadQueuesStore()
      await store.addByFiles(QUEUE, extSystem, licence, [photo('photo.jpg')], 'own')
      const subject = mountDialog()
      const [item] = store.getQueueItems(QUEUE)
      await vi.waitFor(() => expect(item.status).toBe(Processing))
      own.fileBecomes('own-asset-1', AssetFileProcessStatus.Processed, { authors: ['author-1'] })
      await waits.elapse()
      await vi.waitFor(() => expect(item.status).toBe(Uploaded))
      await flushPromises()
      return subject
    }
    const expectSavedAndMappedUnderOwn = (subject: VueWrapper) => {
      expect(subject.emitted('apply')![0]).toMatchObject([
        [{ assetId: 'own-asset-1', texts: { source: 'Own Author' } }],
      ])
      expect(own.sentTo('PATCH', own.routes.bulkMetadata)).toHaveLength(1)
      expect(asked(own)).toContain(`GET ${OWN_AUTHOR}/ext-system/${extSystem}/search`)
      expect(asked(dam)).toEqual([])
    }

    it('the dialog of a queue of files saves, and maps what it saved to images, there', async () => {
      const subject = await uploaded(
        () =>
          mountUnderOwn(way, UploadQueueDialog, dialogProps, {
            stubs: {
              AssetImage: true,
              AFormRemoteAutocompleteWithCached: true,
              AssetQueueSelectedSidebar: true,
              AFileInput: true,
              AFileDropzone: true,
            },
          }) as unknown as VueWrapper
      )
      const saveAndApply = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.v-toolbar button')).find(
        (button) => [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
      )!

      saveAndApply.click()
      await vi.waitFor(() => expect(subject.emitted('apply')).toHaveLength(1))

      expectSavedAndMappedUnderOwn(subject)
    })

    it('the dialog of a single file saves, and maps what it saved to an image, there', async () => {
      const Sidebar = defineComponent({ emits: ['saveAndApply'], setup: () => () => h('div') })
      const subject = await uploaded(
        () =>
          mountUnderOwn(way, UploadQueueDialogSingle, dialogProps, {
            stubs: {
              UploadQueueDialogSingleSidebar: Sidebar,
              AssetDetailDialogLoader: true,
              AssetImage: true,
              DamAssetImageRoiSelectLazy: true,
              UploadQueueButtonStop: true,
            },
          }) as unknown as VueWrapper
      )
      await vi.waitFor(() => expect(subject.findComponent(Sidebar).exists()).toBe(true))

      subject.findComponent(Sidebar).vm.$emit('saveAndApply')
      await vi.waitFor(() => expect(subject.emitted('apply')).toHaveLength(1))

      expectSavedAndMappedUnderOwn(subject)
    })
  })
})
