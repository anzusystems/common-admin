import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, reactive } from 'vue'
import { VExpansionPanels } from 'vuetify/components'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, damAsset, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import AssetFileInfoPanel from '@/domains/dam/assetDetail/components/AssetFileInfoPanel.vue'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import AuthorRemoteAutocompleteCachedAuthorChip from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import KeywordRemoteAutocompleteCachedKeywordChip from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteCachedKeywordChip.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useLibraryUploadQueueListBinding } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// The caches ask 1.5 s after they are given an id. That wait is
// held and let pass inside a case that asserts what was asked.
// The caches live as long as the page, so each case uses ids of its own.

const { endPoints, extSystem: EXT_DEFAULT, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const OWN_AUTHOR = '/own/v2/author'
const OWN_KEYWORD = '/own/v2/keyword'
const EXT_OWN = 2
const NAMES = /^(.*)\/(author|keyword)\/ext-system\/(\d+)\/search$/
/** Waits from this length are held. The caches wait 1.5 s before they ask. */
const HELD_FROM_MS = 1_200

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let wrappers: VueWrapper[] = []

const answerNames = (of: FakeDam, which: string) =>
  of.reply((request) => {
    if (request.method !== 'GET') return undefined
    const [path, query] = request.url.split('?')
    const params = new URLSearchParams(query)
    if (NAMES.test(path!)) {
      const ids = (params.get('id') ?? '').split(',')
      const found = ids.map((id) => ({ id, name: `${id} of ${which}`, identifier: '', flags: { reviewed: true } }))
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    if (path === '/adm/v1/user') {
      const ids = (params.get('filter_in[id]') ?? '').split(',').map(Number)
      const found = ids.map((id) => ({
        id,
        email: `${id}@${which}`,
        avatar: { color: '', text: '' },
        person: { firstName: '', lastName: '', fullName: `${id} of ${which}` },
      }))
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    return undefined
  })

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  answerNames(dam, 'default')
  answerNames(own, 'own')
  const { coreDam } = installConsumerProfile(cmsConfiguration, dam.client)
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
      },
    },
  })
  const ownStore = seedDamConfigOf('own')
  ownStore.damConfigExtSystem.set(EXT_OWN, ownStore.damConfigExtSystem.get(EXT_DEFAULT)!)
  ownStore.damConfigAssetCustomFormElements.set(EXT_OWN, ownStore.damConfigAssetCustomFormElements.get(EXT_DEFAULT)!)
  useExtSystemIdForCached('own').cachedExtSystemId.value = EXT_OWN
  useExtSystemIdForCached('default').cachedExtSystemId.value = EXT_DEFAULT
  waits = holdLongWaits(HELD_FROM_MS)
})
afterEach(async () => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  // Let the ids left in the caches by a case be asked now, with the clients of this case.
  await waits.elapseAll()
  waits.restore()
})

const askedForNames = (of: FakeDam) =>
  of.requests
    .map((request) => `${request.method} ${request.url.split('?')[0]}`)
    .filter((request) => NAMES.test(request.split(' ')[1]!) || request.endsWith('/adm/v1/user'))
const cachesAsk = async () => {
  await waits.elapse()
  await flushPromises()
}

const UnderOwn = defineComponent({
  setup(_, { slots }) {
    useDamConfigName('own')

    return () => slots.default?.()
  },
})
const ways = ['given the name', 'inside a component under it'] as const
type Way = (typeof ways)[number]
const mountUnderOwn = async (way: Way, component: Component, props: Record<string, unknown>, stubs = {}) => {
  const host =
    way === 'given the name'
      ? defineComponent({ setup: () => () => h(component, { ...props, configName: 'own' }) })
      : defineComponent({ setup: () => () => h(UnderOwn, () => h(component, props)) })
  const wrapper = mount(host, { attachTo: document.body, global: { plugins: [pinia], stubs } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('a chip under a named DAM configuration', () => {
  it.each(ways)(
    "asks that configuration's client for the author's name, at its address, under its ext system: %s",
    async (way) => {
      const id = `author-chip-${way.length}`
      const chip = await mountUnderOwn(way, AuthorRemoteAutocompleteCachedAuthorChip, { id })

      await cachesAsk()

      expect(askedForNames(own)).toEqual([`GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`])
      expect(askedForNames(dam)).toEqual([])
      expect(chip.text()).toContain(`${id} of own`)
    }
  )

  it("asks that configuration's client for the keyword's name, inside a component under it", async () => {
    const chip = await mountUnderOwn('inside a component under it', KeywordRemoteAutocompleteCachedKeywordChip, {
      id: 'keyword-chip',
    })

    await cachesAsk()

    expect(askedForNames(own)).toEqual([`GET ${OWN_KEYWORD}/ext-system/${EXT_OWN}/search`])
    expect(askedForNames(dam)).toEqual([])
    expect(chip.text()).toContain('keyword-chip of own')
  })

  it('of one author shown under both names: each is asked for once, and each chip shows the name of its DAM', async () => {
    const ofDefault = mount(AuthorRemoteAutocompleteCachedAuthorChip, {
      props: { id: 'author-both' },
      global: { plugins: [pinia] },
    })
    wrappers.push(ofDefault)
    const ofOwn = await mountUnderOwn('given the name', AuthorRemoteAutocompleteCachedAuthorChip, { id: 'author-both' })

    await cachesAsk()

    expect(askedForNames(dam)).toEqual([`GET /adm/v1/author/ext-system/${EXT_DEFAULT}/search`])
    expect(askedForNames(own)).toEqual([`GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`])
    expect([ofDefault.text(), ofOwn.text()]).toEqual(['author-both of default', 'author-both of own'])
  })
})

describe('the panel of the file under a named DAM configuration', () => {
  it('shows who created and who changed the asset by the users of that configuration', async () => {
    useDamCachedUsers('own').addManualToCachedUsers({
      id: 71,
      email: '',
      avatar: { color: '', text: '' },
      person: { firstName: '', lastName: '', fullName: 'Creator of own' },
    } as never)
    useDamCachedUsers('default').addManualToCachedUsers({
      id: 71,
      email: '',
      avatar: { color: '', text: '' },
      person: { firstName: '', lastName: '', fullName: 'Creator of default' },
    } as never)

    const panel = await mountUnderOwn(
      'inside a component under it',
      defineComponent({
        setup: () => () =>
          h(VExpansionPanels, { modelValue: ['file'] }, () => [
            h(AssetFileInfoPanel, {
              asset: damAsset('asset-users', { createdBy: 71, modifiedBy: 71 }),
              showUsers: true,
            }),
          ]),
      }),
      {}
    )

    expect(panel.html()).toContain('Creator of own')
    expect(panel.html()).not.toContain('Creator of default')
  })
})

describe('what fills the caches of a named DAM configuration', () => {
  it("the conflict chips of the asset detail: that configuration's cache asks its client", async () => {
    useAssetDetailStore().setAsset(
      damAsset('asset-conflicts', {
        licence,
        metadata: {
          authorSuggestions: { 'Two Authors': ['author-conflict-1', 'author-conflict-2'] },
          keywordSuggestions: {},
          customData: {},
        },
      })
    )

    await mountUnderOwn(
      'given the name',
      AssetMetadata,
      { extSystem: EXT_OWN },
      {
        KeywordRemoteAutocompleteWithCached: true,
        AuthorRemoteAutocompleteWithCached: true,
      }
    )
    await cachesAsk()

    expect(askedForNames(own)).toEqual([`GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`, 'GET /adm/v1/user'])
    expect(askedForNames(dam)).toEqual([])
    expect(useDamCachedAuthors('own').getCachedAuthor('author-conflict-1')?.name).toBe('author-conflict-1 of own')
    expect(useDamCachedAuthors('default').getCachedAuthor('author-conflict-1')).toBeUndefined()
  })

  it("the list binding's prime of a queue of that configuration", async () => {
    const row = reactive(
      useUploadQueueItemFactory().createDefault(
        'row',
        UploadQueueItemType.File,
        UploadQueueItemStatus.Uploaded,
        DamAssetType.Image,
        1,
        licence
      )
    ) as UploadQueueItem
    row.keywords = ['keyword-prime']
    row.authors = ['author-prime']

    useLibraryUploadQueueListBinding('named-prime', 'own').prime([row])
    await cachesAsk()

    expect(askedForNames(own).sort()).toEqual(
      [`GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`, `GET ${OWN_KEYWORD}/ext-system/${EXT_OWN}/search`].sort()
    )
    expect(askedForNames(dam)).toEqual([])
  })

  it('a click in the asset select of that configuration: the names and the users of the asset clicked', async () => {
    own.assets.set(
      'asset-clicked',
      damAsset('asset-clicked', {
        licence,
        authors: ['author-click'],
        keywords: ['keyword-click'],
        createdBy: 72,
        modifiedBy: 72,
      })
    )

    let actions: ReturnType<typeof useAssetSelectActions> | undefined
    wrappers.push(
      mount(
        defineComponent({
          setup() {
            actions = useAssetSelectActions('own')
            return () => null
          },
        }),
        { global: { plugins: [pinia] } }
      )
    )

    await actions!.onItemClick({ assetId: 'asset-clicked', index: 0 }, EXT_OWN)
    await cachesAsk()

    expect(askedForNames(own).sort()).toEqual(
      [
        `GET ${OWN_AUTHOR}/ext-system/${EXT_OWN}/search`,
        `GET ${OWN_KEYWORD}/ext-system/${EXT_OWN}/search`,
        'GET /adm/v1/user',
      ].sort()
    )
    expect(askedForNames(dam)).toEqual([])
    expect(useDamCachedUsers('own').getCachedUser(72)?.person.fullName).toBe('72 of own')
  })

  it('a keyword made in the input of that configuration: shown by a chip under it without a request', async () => {
    own.reply((request) =>
      request.method === 'POST' && request.url === OWN_KEYWORD
        ? { status: 201, data: { ...JSON.parse(request.data as string), id: 'keyword-made' } }
        : undefined
    )
    const Input = defineComponent({
      name: 'NameInputStandIn',
      props: { useCached: { type: Function, default: undefined } },
      emits: ['update:search'],
      setup:
        (_, { slots }) =>
        () =>
          h('div', { class: 'name-input' }, slots['append-item']?.()),
    })
    const input = await mountUnderOwn(
      'given the name',
      KeywordRemoteAutocompleteWithCached,
      { modelValue: [], extSystem: EXT_OWN, multiple: true },
      { AFormRemoteAutocompleteWithCached: Input }
    )
    input.findComponent(Input).vm.$emit('update:search', 'made keyword')
    await flushPromises()
    await input.find('.name-input').trigger('keyup', { key: 'Enter' })
    await vi.waitFor(() =>
      expect(input.findComponent(KeywordRemoteAutocompleteWithCached).emitted('update:modelValue')).toHaveLength(1)
    )
    const asked = own.requests.length

    const chip = await mountUnderOwn('inside a component under it', KeywordRemoteAutocompleteCachedKeywordChip, {
      id: 'keyword-made',
    })
    await cachesAsk()

    expect(chip.text()).toContain('made keyword')
    expect(own.requests).toHaveLength(asked)
    expect(useDamCachedKeywords('default').getCachedKeyword('keyword-made')).toBeUndefined()
    expect(dam.requests).toEqual([])
  })
})

describe('an author chip under a named DAM configuration', () => {
  it("keeps its author's name while the cache of that configuration fills up", async () => {
    const chip = await mountUnderOwn('given the name', AuthorRemoteAutocompleteCachedAuthorChip, {
      id: 'author-pinned',
    })
    await cachesAsk()
    expect(chip.text()).toContain('author-pinned of own')

    const { addManualToCachedAuthors } = useDamCachedAuthors('own')
    for (let index = 0; index < 1_001; index++) {
      addManualToCachedAuthors({
        id: `author-filling-${index}`,
        name: 'Any',
        identifier: '',
        flags: { reviewed: true },
      } as never)
    }
    await flushPromises()

    expect(useDamCachedAuthors('own').getCachedAuthor('author-pinned')?.name).toBe('author-pinned of own')
    expect(chip.text()).toContain('author-pinned of own')
  })

  it('shows an author made in the input given that configuration, under a component of default, without a request', async () => {
    own.reply((request) =>
      request.method === 'POST' && request.url === OWN_AUTHOR
        ? { status: 201, data: { ...JSON.parse(request.data as string), id: 'author-made' } }
        : undefined
    )
    const Input = defineComponent({
      name: 'NameInputStandIn',
      props: { useCached: { type: Function, default: undefined } },
      emits: ['update:search'],
      setup:
        (_, { slots }) =>
        () =>
          h('div', { class: 'name-input' }, slots['append-item']?.()),
    })
    const input = await mountUnderOwn(
      'given the name',
      AuthorRemoteAutocompleteWithCached,
      { modelValue: [], extSystem: EXT_OWN, multiple: true },
      { AFormRemoteAutocompleteWithCached: Input }
    )
    input.findComponent(Input).vm.$emit('update:search', 'Made Author')
    await flushPromises()
    await input.find('.name-input').trigger('keyup', { key: 'Enter' })
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-cy="button-confirm"]')!.click()
    await vi.waitFor(() =>
      expect(input.findComponent(AuthorRemoteAutocompleteWithCached).emitted('update:modelValue')).toHaveLength(1)
    )
    const asked = own.requests.length

    const chip = await mountUnderOwn('inside a component under it', AuthorRemoteAutocompleteCachedAuthorChip, {
      id: 'author-made',
    })
    await cachesAsk()

    expect(chip.text()).toContain('Made Author')
    expect(own.requests).toHaveLength(asked)
    expect(useDamCachedAuthors('default').getCachedAuthor('author-made')).toBeUndefined()
    expect(dam.requests).toEqual([])
  })
})

describe('a configuration the application has not got', () => {
  it('gets no cache: asked for, its name throws, also when asked again', () => {
    for (const use of [useDamCachedAuthors, useDamCachedKeywords, useDamCachedUsers]) {
      expect(() => use('typo')).toThrow("Composable can't be used without properly configured common admin.")
      expect(() => use('typo')).toThrow("Composable can't be used without properly configured common admin.")
    }
  })

  it('is refused by the author chip given its name, before anything is asked', () => {
    expect(() =>
      mount(AuthorRemoteAutocompleteCachedAuthorChip, {
        props: { id: 'author-typo', configName: 'typo' },
        global: { plugins: [pinia] },
      })
    ).toThrow("Composable can't be used without properly configured common admin.")
    expect([...own.requests, ...dam.requests]).toEqual([])
  })
})

describe('the caches of two configurations', () => {
  it.each([
    ['own', 'default'],
    ['default', 'own'],
  ] as const)("keep a name of %s's cache while %s's fills up", (kept, filled) => {
    useDamCachedAuthors(kept).addManualToCachedAuthors({
      id: `author-kept-${kept}`,
      name: 'Kept',
      identifier: '',
      flags: { reviewed: true },
    } as never)

    const { addManualToCachedAuthors } = useDamCachedAuthors(filled)
    for (let index = 0; index < 1_001; index++) {
      addManualToCachedAuthors({
        id: `author-${filled}-${index}`,
        name: 'Any',
        identifier: '',
        flags: { reviewed: true },
      } as never)
    }

    expect(useDamCachedAuthors(kept).getCachedAuthor(`author-kept-${kept}`)?.name).toBe('Kept')
  })

  it('are those of default for a call with no name outside a component: the instance an application uses', () => {
    expect(useDamCachedAuthors().cachedAuthors).toBe(useDamCachedAuthors('default').cachedAuthors)
    expect(useDamCachedKeywords().cachedKeywords).toBe(useDamCachedKeywords('default').cachedKeywords)
    expect(useDamCachedUsers().cachedUsers).toBe(useDamCachedUsers('default').cachedUsers)
    expect(useDamCachedAuthors('own').cachedAuthors).not.toBe(useDamCachedAuthors().cachedAuthors)
    expect(useExtSystemIdForCached().cachedExtSystemId).toBe(useExtSystemIdForCached('default').cachedExtSystemId)
    expect(useExtSystemIdForCached('own').cachedExtSystemId).not.toBe(useExtSystemIdForCached().cachedExtSystemId)
  })
})
