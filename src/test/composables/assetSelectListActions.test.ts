import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { Pagination } from '@/labs/filters/pagination'

const { executeFetch, showErrorsDefault, debounce } = vi.hoisted(() => ({
  executeFetch: vi.fn(),
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
      damClient: vi.fn(),
      endPointAsset: '/adm/v1/asset',
      showFileInfoEnabled: false,
    }),
  }),
)

vi.mock('@/labs/api/useApiFetchList', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/labs/api/useApiFetchList')>()),
  useApiFetchList: () => ({ executeFetch }),
}))

vi.mock('@/composables/system/alerts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/system/alerts')>()
  return { ...actual, useAlerts: () => ({ ...actual.useAlerts(), showErrorsDefault }) }
})

const asset = (id: string) =>
  ({ id, licence: 10, mainFile: { id: `file-${id}` } }) as unknown as AssetSearchListItemDto

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
})
