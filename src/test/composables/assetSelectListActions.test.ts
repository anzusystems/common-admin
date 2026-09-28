import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { DamAssetType } from '@/types/coreDam/Asset'

// The dialog answers what the user did last: an older list or detail response must not replace the
// newer one, and a next page that failed must be asked for again rather than skipped.
const deferred = <T>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}
const api = vi.hoisted(() => ({ list: [] as any[], detail: new Map<string, any>() }))
vi.mock('@/components/damImage/uploadQueue/api/damAssetApi', () => ({
  ENTITY: 'asset',
  ...Object.fromEntries(
    [
      'fetchAssetAsCmsMedia',
      'fetchAssetByFileId',
      'bulkUpdateAssetsMetadata',
      'fetchAssetListByIds',
      'updateAssetMetadata',
      'updateAssetAuthors',
      'bulkUpdateAssetsAuthors',
    ].map((name) => [name, vi.fn()])
  ),
  useFetchAssetList: () => ({ execute: () => (api.list.push(deferred()), api.list.at(-1).promise) }),
  fetchAsset: (_c: unknown, _e: unknown, id: string) => (api.detail.set(id, deferred()), api.detail.get(id).promise),
}))
vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset', showFileInfoEnabled: false }),
}))
const noop = {
  addToCachedAuthors: () => {},
  fetchCachedAuthors: () => {},
  addToCachedKeywords: () => {},
  fetchCachedKeywords: () => {},
}
vi.mock('@/components/damImage/uploadQueue/author/cachedAuthors', () => ({ useDamCachedAuthors: () => noop }))
vi.mock('@/components/damImage/uploadQueue/keyword/cachedKeywords', () => ({ useDamCachedKeywords: () => noop }))

const asset = (id: string) => ({ id, authors: [], keywords: [], mainFile: null }) as any
const setup = () => {
  let actions!: ReturnType<typeof useAssetSelectActions>
  mount(defineComponent({ setup: () => ((actions = useAssetSelectActions()), () => h('div')) }))
  const store = useAssetSelectStore()
  store.setSelectConfig([{ licence: 1, extSystem: 1, licenceName: '', extSystemConfig: {} as any }])
  store.setAssetType(DamAssetType.Image)
  api.list.length = 0
  return { actions, store }
}

describe('useAssetSelectActions races', () => {
  it('keeps the newer list when the older answer arrives last', async () => {
    const { actions, store } = setup()
    const first = actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(api.list).toHaveLength(1))
    const second = actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(api.list).toHaveLength(2))
    api.list[1].resolve([asset('new')])
    api.list[0].resolve([asset('old')])
    await Promise.all([first, second])
    expect(store.assetListItems.map((item) => item.asset.id)).toEqual(['new'])
  })

  it('shows the detail of the asset clicked last', async () => {
    const { actions, store } = setup()
    store.setList([asset('A'), asset('B')])
    const a = actions.onItemClick({ assetId: 'A', index: 0 }, 1)
    const b = actions.onItemClick({ assetId: 'B', index: 1 }, 1)
    api.detail.get('B').resolve(asset('B'))
    await flushPromises()
    api.detail.get('A').resolve(asset('A'))
    await Promise.all([a, b])
    expect(useAssetDetailStore().asset?.id).toBe('B')
  })

  it('asks for the same page again after a failed next page', async () => {
    const { actions } = setup()
    actions.pagination.value.page = 1
    const failed = actions.fetchNextPage()
    api.list[0].reject(new Error('network'))
    await failed
    expect(actions.pagination.value.page).toBe(1)
  })

  it('drops a next page of the old filter that arrives after the new list', async () => {
    const { actions, store } = setup()
    store.setList([asset('old-1')])
    actions.pagination.value.page = 1
    const nextPage = actions.fetchNextPage()
    expect(api.list).toHaveLength(1)
    // The filter is submitted while page 2 of the old one is still loading.
    actions.pagination.value.page = 1
    const list = actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(api.list).toHaveLength(2))
    api.list[1].resolve([asset('new-1')])
    await list
    expect(store.loader).toBe(false)
    api.list[0].resolve([asset('old-2')])
    await nextPage

    expect(store.assetListItems.map((item) => item.asset.id)).toEqual(['new-1'])
    expect(actions.pagination.value.page).toBe(1)
  })

  it('keeps the loader up while the new list loads, even when the old next page settles first', async () => {
    const { actions, store } = setup()
    const nextPage = actions.fetchNextPage()
    const list = actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(api.list).toHaveLength(2))
    api.list[0].resolve([asset('old-2')])
    await nextPage
    expect(store.loader).toBe(true)
    api.list[1].resolve([asset('new-1')])
    await list
    expect(store.loader).toBe(false)
  })
})
