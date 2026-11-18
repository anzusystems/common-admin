import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, type Ref } from 'vue'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { Pagination } from '@/domains/api/composables/pagination'
import { generateListQuery } from '@/domains/api/composables/useApiFetchList'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { IntegerId } from '@/shared/types/common'

// Which list the picker asks for: the licence it browses at its own address, which every DAM has (the UGC proxy of
// core-dam has only this one), or several licences of a list view in one search at `/licence`.
const api = vi.hoisted(() => ({ asked: [] as Array<{ url: string; query: string }> }))
const answering = (url: string) => ({
  execute: async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    api.asked.push({ url, query: generateListQuery(pagination, filterData, filterConfig) })
    return [{ id: 'listed', licence: 10, mainFile: null, authors: [], keywords: [] }]
  },
})
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFetchAssetList: (_client: unknown, endPoint: string, licenceId: IntegerId) =>
    answering(`${endPoint}/licence/${licenceId}`),
  useFetchAssetListByLicences: (_client: unknown, endPoint: string) => answering(`${endPoint}/licence`),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({
    damClient: () => ({}),
    endPointAsset: '/ugc/v1/asset',
    showFileInfoEnabled: false,
  }),
}))

let pinia: Pinia

// Its own Pinia: the one of the test setup lives as long as the file.
const mountActions = () => {
  let actions!: ReturnType<typeof useAssetSelectActions>
  mount(defineComponent({ setup: () => ((actions = useAssetSelectActions('default')), () => h('div')) }), {
    global: { plugins: [pinia] },
  })
  return actions
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  const store = useAssetSelectStore(pinia)
  store.setSelectConfig(
    [10, 20].map((licence) => ({ licence, extSystem: 1, licenceName: '', extSystemConfig: {} as never }))
  )
  store.setAssetType(DamAssetType.Image)
  api.asked.length = 0
})
afterEach(() => {
  vi.useRealTimers()
})

describe('the asset list of a picker', () => {
  it('reads one licence at its own address, with no licence filter', async () => {
    const actions = mountActions()
    useAssetSelectStore(pinia).setSelectedLicenceIds([20])

    await actions.fetchAssetListDebounced()
    await flushPromises()

    expect(api.asked.map(({ url }) => url)).toEqual(['/ugc/v1/asset/licence/20'])
    expect(api.asked[0]!.query).not.toContain('licences')
  })

  it('reads several licences in one search at /licence, with the licences in the filter', async () => {
    const actions = mountActions()
    useAssetSelectStore(pinia).setSelectedLicenceIds([10, 20])

    await actions.fetchAssetListDebounced()
    await flushPromises()

    expect(api.asked.map(({ url }) => url)).toEqual(['/ugc/v1/asset/licence'])
    expect(decodeURIComponent(api.asked[0]!.query)).toContain('licences=10,20')
  })

  it('reads a further page the same way as the list', async () => {
    const actions = mountActions()
    useAssetSelectStore(pinia).setSelectedLicenceIds([10, 20])
    await actions.fetchAssetListDebounced()
    await flushPromises()

    await actions.fetchNextPage()

    expect(api.asked.map(({ url }) => url)).toEqual(['/ugc/v1/asset/licence', '/ugc/v1/asset/licence'])
  })

  it('asks DAM for nothing without a licence, not even a next page', async () => {
    const actions = mountActions()
    const page = actions.pagination.value.page

    await actions.fetchAssetListDebounced()
    await actions.fetchNextPage()
    await flushPromises()

    expect(api.asked).toEqual([])
    expect(actions.pagination.value.page).toBe(page)
  })

  it('sends one search when the filter and the picker ask for the first listing in the same tick', async () => {
    vi.useFakeTimers()
    const filter = mountActions()
    const picker = mountActions()
    useAssetSelectStore(pinia).setSelectedLicenceIds([10])

    void filter.fetchAssetListDebounced()
    void picker.fetchAssetListDebounced()
    await vi.runAllTimersAsync()

    expect(api.asked).toHaveLength(1)
    expect(useAssetSelectStore(pinia).assetListItems.map((item) => item.asset.id)).toEqual(['listed'])
  })
})
