import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import {
  DamAssetType,
  type AssetSearchListItemDto,
  type AssetSingleUseUsage,
} from '@/types/coreDam/Asset'
import type { Pagination } from '@/labs/filters/pagination'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'

const { executeFetch, fetchUsage, damGet, showErrorsDefault, debounce } = vi.hoisted(() => ({
  executeFetch: vi.fn(),
  fetchUsage: vi.fn(),
  damGet: vi.fn(),
  showErrorsDefault: vi.fn(),
  debounce: { real: false },
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useDebounceFn: (fn: (...args: never[]) => Promise<void>) => {
      const debounced = actual.useDebounceFn(fn)
      return (...args: never[]) => (debounce.real ? debounced(...args) : fn(...args))
    },
  }
})

vi.mock(
  '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions')
    >()),
    useCommonAdminCoreDamOptions: () => ({
      damClient: () => ({ get: damGet }),
      endPointAsset: '/adm/v1/asset',
      showFileInfoEnabled: false,
    }),
  }),
)

vi.mock('@/components/damImage/composables/commonAdminImageOptions', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/components/damImage/composables/commonAdminImageOptions')
  >()),
  useImageSingleUseUsageFetch: () => fetchUsage,
}))

vi.mock('@/components/dam/user/assetLicenceApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/dam/user/assetLicenceApi')>()),
  fetchDamAssetLicenceListByIds: () =>
    Promise.resolve([{ id: 10, name: 'Licence', badge: 'L', flags: { directUseAllowed: true } }]),
}))

vi.mock('@/labs/api/useApiFetchList', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/labs/api/useApiFetchList')>()),
  useApiFetchList: () => ({ executeFetch }),
}))

vi.mock('@/composables/system/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/system/alerts')>()
  return { ...actual, useAlerts: () => ({ ...actual.useAlerts(), showErrorsDefault }) }
})

const asset = (id: string) =>
  ({
    id,
    licence: 10,
    mainFile: {
      id: `file-${id}`,
      flags: { singleUse: false },
      fileAttributes: { takenOverFromId: '' },
    },
    attributes: { assetType: DamAssetType.Image },
  }) as unknown as AssetSearchListItemDto

const singleUseAsset = (id: string, takenOverFromId = '') =>
  ({
    ...asset(id),
    mainFile: { id: `file-${id}`, flags: { singleUse: true }, fileAttributes: { takenOverFromId } },
  }) as unknown as AssetSearchListItemDto

const usage = (blocked: boolean): AssetSingleUseUsage => ({
  holder: null,
  status: blocked ? 'conflict' : 'free',
  blocked,
  usageCount: blocked ? 1 : 0,
  usages: [],
})

const usageHolder = { name: 'articleKindStandard', id: 42 }

const deferredList = () => {
  let resolve!: (list: AssetSearchListItemDto[]) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<AssetSearchListItemDto[]>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

type ListResponse = ReturnType<typeof deferredList>

let pinia: Pinia

const mountActions = () => {
  let actions!: ReturnType<typeof useAssetSelectActions>
  let store!: ReturnType<typeof useAssetSelectStore>
  mount(
    defineComponent({
      setup() {
        actions = useAssetSelectActions()
        store = useAssetSelectStore()
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia] } },
  )
  return { actions, store }
}

const startTwoSearches = () => {
  const { actions, store } = mountActions()
  const older = deferredList()
  const newer = deferredList()
  executeFetch.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
  store.setSelectedLicenceIds([10])
  void actions.fetchAssetListDebounced()
  void actions.fetchAssetListDebounced()
  return { store, older, newer }
}

const listedIds = (store: ReturnType<typeof useAssetSelectStore>) =>
  store.assetListItems.map((item) => item.asset.id)

const answeringWithPagination =
  (response: ListResponse, hasNextPage: boolean, currentViewCount: number) =>
  async (pagination: Ref<Pagination>) => {
    const list = await response.promise
    pagination.value = { ...pagination.value, hasNextPage, currentViewCount }
    return list
  }

describe('useAssetSelectActions', () => {
  beforeEach(() => {
    pinia = createPinia()
    executeFetch.mockReset()
    fetchUsage.mockReset()
    fetchUsage.mockResolvedValue({})
    showErrorsDefault.mockReset()
  })

  afterEach(() => {
    debounce.real = false
    vi.useRealTimers()
  })

  it.each<[string, (older: ListResponse) => void]>([
    ['answers with its own list', (older) => older.resolve([asset('older')])],
    ['fails', (older) => older.reject(new Error('timeout'))],
  ])('keeps the newer search when the older one %s after it', async (_name, settleOlder) => {
    const { store, older, newer } = startTwoSearches()

    newer.resolve([asset('newer')])
    await flushPromises()
    settleOlder(older)
    await flushPromises()

    expect(listedIds(store)).toEqual(['newer'])
    expect(showErrorsDefault).not.toHaveBeenCalled()
    expect(store.loader).toBe(false)
  })

  it.each<[string, (nextPage: ListResponse) => void]>([
    ['answers with its own page', (nextPage) => nextPage.resolve([asset('older-next-page')])],
    ['fails', (nextPage) => nextPage.reject(new Error('timeout'))],
  ])(
    'keeps the newer search when the next page of the older one %s after it',
    async (_name, settleNextPage) => {
      const { actions, store } = mountActions()
      const nextPage = deferredList()
      const newer = deferredList()
      executeFetch
        .mockResolvedValueOnce([asset('older')])
        .mockReturnValueOnce(nextPage.promise)
        .mockReturnValueOnce(newer.promise)
      store.setSelectedLicenceIds([10])
      await actions.fetchAssetListDebounced()
      await flushPromises()
      void actions.fetchNextPage()
      void actions.fetchAssetListDebounced()

      newer.resolve([asset('newer')])
      await flushPromises()
      settleNextPage(nextPage)
      await flushPromises()

      expect(listedIds(store)).toEqual(['newer'])
      expect(showErrorsDefault).not.toHaveBeenCalled()
      expect(store.loader).toBe(false)
    },
  )

  it.each<
    [
      string,
      (actions: ReturnType<typeof useAssetSelectActions>, older: ListResponse) => Promise<void>,
    ]
  >([
    [
      'first listing',
      async (actions, older) => {
        executeFetch.mockImplementationOnce(answeringWithPagination(older, true, 25))
        void actions.fetchAssetListDebounced()
      },
    ],
    [
      'next page',
      async (actions, older) => {
        executeFetch
          .mockResolvedValueOnce([asset('older')])
          .mockImplementationOnce(answeringWithPagination(older, true, 25))
        await actions.fetchAssetListDebounced()
        await flushPromises()
        void actions.fetchNextPage()
      },
    ],
  ])(
    'keeps the pagination of the newer search when the %s of the older one answers after it',
    async (_name, startOlder) => {
      const { actions, store } = mountActions()
      const older = deferredList()
      const newer = deferredList()
      store.setSelectedLicenceIds([10])
      await startOlder(actions, older)
      executeFetch.mockImplementationOnce(answeringWithPagination(newer, false, 3))
      void actions.fetchAssetListDebounced()

      newer.resolve([asset('newer')])
      await flushPromises()
      older.resolve([asset('older')])
      await flushPromises()

      expect(actions.pagination.value.hasNextPage).toBe(false)
      expect(actions.pagination.value.currentViewCount).toBe(3)
    },
  )

  it('sends one search when the filter and the picker ask for the first listing in the same tick', async () => {
    debounce.real = true
    vi.useFakeTimers()
    const filter = mountActions()
    const picker = mountActions()
    executeFetch.mockResolvedValue([asset('listed')])
    filter.store.setSelectedLicenceIds([10])

    void filter.actions.fetchAssetListDebounced()
    void picker.actions.fetchAssetListDebounced()
    await vi.runAllTimersAsync()

    expect(executeFetch).toHaveBeenCalledTimes(1)
    expect(listedIds(filter.store)).toEqual(['listed'])
  })

  it.each([
    [true, null],
    [false, false],
  ])(
    'lists single use photos only for a record type that may use them (allowed %s)',
    async (singleUseAllowed, mainFileSingleUse) => {
      const { actions, store } = mountActions()
      executeFetch.mockResolvedValue([])
      store.setSelectedLicenceIds([10])
      store.setSelectability({ singleUseAllowed, uploadLicence: undefined, usageHolder: null })

      await actions.fetchAssetListDebounced()
      await flushPromises()

      expect(useAssetListFilter().filterData.mainFileSingleUse).toBe(mainFileSingleUse)
    },
  )

  it('loads the sources of the clicked asset for the detail, not only its authors', async () => {
    const { actions, store } = mountActions()
    store.setSelectConfig([{ licence: 10, extSystem: 1 }] as DamConfigLicenceExtSystemReturnType[])
    store.setList([asset('clicked')])
    damGet.mockResolvedValue({
      status: 200,
      data: { id: 'clicked', authors: ['author-id'], sources: ['source-id'], keywords: [] },
    })

    await actions.onItemClick({ assetId: 'clicked', index: 0 })

    const { hasCachedAuthor } = useDamCachedAuthors()
    expect(hasCachedAuthor('author-id')).toBe(true)
    expect(hasCachedAuthor('source-id')).toBe(true)
  })

  it('asks DAM for no next page without a licence', async () => {
    const { actions } = mountActions()
    const page = actions.pagination.value.page

    await actions.fetchNextPage()

    expect(executeFetch).not.toHaveBeenCalled()
    expect(actions.pagination.value.page).toBe(page)
  })

  it('keeps the licences when the same ones come again, so the list does not reload', () => {
    const { store } = mountActions()
    store.setSelectedLicenceIds([10, 20])
    const selected = store.selectedLicenceIds

    store.setSelectedLicenceIds([20, 10])

    expect(store.selectedLicenceIds).toBe(selected)
  })

  it('keeps loading while the newer search runs after the older one answered', async () => {
    const { store, older, newer } = startTwoSearches()

    older.resolve([asset('older')])
    await flushPromises()

    expect(listedIds(store)).toEqual([])
    expect(store.loader).toBe(true)

    newer.resolve([asset('newer')])
    await flushPromises()

    expect(listedIds(store)).toEqual(['newer'])
    expect(store.loader).toBe(false)
  })

  describe('single use usage of a page', () => {
    const selectableStore = (store: ReturnType<typeof useAssetSelectStore>) => {
      store.setSelectedLicenceIds([10])
      store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
    }

    it('asks the host once per page for the distinct groups of the single use photos', async () => {
      const { actions, store } = mountActions()
      selectableStore(store)
      const audio = {
        ...singleUseAsset('e'),
        attributes: { assetType: DamAssetType.Audio },
      } as unknown as AssetSearchListItemDto
      executeFetch.mockResolvedValue([
        singleUseAsset('a', 'group-1'),
        singleUseAsset('b', 'group-1'),
        singleUseAsset('c'),
        asset('d'),
        audio,
      ])
      fetchUsage.mockResolvedValue({ 'group-1': usage(true), 'file-c': usage(false) })

      await actions.fetchAssetListDebounced()
      await flushPromises()

      expect(fetchUsage).toHaveBeenCalledTimes(1)
      expect(fetchUsage).toHaveBeenCalledWith(['group-1', 'file-c'], usageHolder)
      const [a, b, c, d] = store.assetListItems
      expect(a.asset.singleUseUsage).toEqual(usage(true))
      expect(b.asset.singleUseUsage).toEqual(usage(true))
      expect(c.asset.singleUseUsage).toEqual(usage(false))
      expect(d.asset.singleUseUsage).toBeUndefined()
      expect(a.disabledReason).toBeTruthy()
      expect(b.disabledReason).toBeTruthy()
      expect(c.disabledReason).toBeNull()
    })

    it('asks again for the next page with the groups of that page only', async () => {
      const { actions, store } = mountActions()
      selectableStore(store)
      executeFetch
        .mockResolvedValueOnce([singleUseAsset('a', 'group-1')])
        .mockResolvedValueOnce([singleUseAsset('b', 'group-2')])

      await actions.fetchAssetListDebounced()
      await flushPromises()
      await actions.fetchNextPage()
      await flushPromises()

      expect(fetchUsage).toHaveBeenCalledTimes(2)
      expect(fetchUsage).toHaveBeenLastCalledWith(['group-2'], usageHolder)
    })

    it('asks nobody without selectability or without a single use photo', async () => {
      const { actions, store } = mountActions()
      store.setSelectedLicenceIds([10])
      executeFetch.mockResolvedValue([singleUseAsset('a')])

      await actions.fetchAssetListDebounced()
      await flushPromises()
      store.setSelectability({ singleUseAllowed: true, uploadLicence: undefined, usageHolder })
      executeFetch.mockResolvedValue([asset('b')])
      await actions.fetchAssetListDebounced()
      await flushPromises()

      expect(fetchUsage).not.toHaveBeenCalled()
    })

    it('shows the error and leaves the photos selectable when the host rejects', async () => {
      const { actions, store } = mountActions()
      selectableStore(store)
      const error = new Error('host down')
      executeFetch.mockResolvedValue([singleUseAsset('a', 'group-1')])
      fetchUsage.mockRejectedValue(error)

      await actions.fetchAssetListDebounced()
      await flushPromises()

      expect(showErrorsDefault).toHaveBeenCalledWith(error)
      expect(listedIds(store)).toEqual(['a'])
      expect(store.assetListItems[0].disabledReason).toBeNull()
      expect(store.loader).toBe(false)
    })
  })
})
