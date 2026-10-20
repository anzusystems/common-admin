import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetSelectReturnType } from '@/domains/dam/types/AssetSelect'

// The list of the asset pickers and of the asset list (admin-ugc), over its actions and its store. After a read of a
// click that failed, the tile clicked was marked beside a panel that showed another asset or none, and the asset the
// list remembered was the one read once a detail had closed. An asset two pages returned kept its check on one tile
// when a click on the other took it out. A new list asked for while a list was on its way turned the loader off for
// the pause before its read, and an empty list said there was nothing found meanwhile. A further page that failed was
// remembered once for the page, and a button that left the view by a change of the layout alone asked again as it
// came back. The requests are stand-ins the case answers.
const deferred = <T>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}
const api = vi.hoisted(() => ({ list: [] as any[], detail: new Map<string, any>(), detailAsked: [] as string[] }))
vi.mock('@/domains/dam/api/damAssetApi', () => ({
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
  fetchAsset: (_c: unknown, _e: unknown, id: string) => (
    api.detailAsked.push(id),
    api.detail.set(id, deferred()),
    api.detail.get(id).promise
  ),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset', showFileInfoEnabled: false }),
}))
const noop = {
  addToCachedAuthors: () => {},
  fetchCachedAuthors: () => {},
  addToCachedKeywords: () => {},
  fetchCachedKeywords: () => {},
}
vi.mock('@/domains/dam/author/composables/cachedAuthors', () => ({ useDamCachedAuthors: () => noop }))
vi.mock('@/domains/dam/keyword/composables/cachedKeywords', () => ({ useDamCachedKeywords: () => noop }))

const asset = (id: string) => ({ id, authors: [], keywords: [], mainFile: null }) as any
const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})
/** The actions of one list, as each list mounts them. */
const listActions = () => {
  let actions!: ReturnType<typeof useAssetSelectActions>
  mounted.push(mount(defineComponent({ setup: () => ((actions = useAssetSelectActions()), () => h('div')) })))
  return actions
}
const setup = async () => {
  const actions = listActions()
  await actions.reset()
  const store = useAssetSelectStore()
  store.setSelectConfig([{ licence: 1, extSystem: 1, licenceName: '', extSystemConfig: {} as any }])
  store.setAssetType(DamAssetType.Image)
  api.list.length = 0
  api.detailAsked.length = 0
  return { actions, store }
}
const activeIds = () =>
  useAssetSelectStore()
    .assetListItems.filter((item) => item.active)
    .map((item) => item.asset.id)
const checked = () => useAssetSelectStore().assetListItems.map((item) => item.selected)

describe('the side panel of a list, after a read of a click that failed', () => {
  it('has the tile of the asset the panel still shows marked, not the tile clicked', async () => {
    const { actions, store } = await setup()
    store.setList([asset('A'), asset('B')])
    const first = actions.onItemClick({ assetId: 'A', index: 0 }, 1)
    api.detail.get('A').resolve(asset('A'))
    await first

    const second = actions.onItemClick({ assetId: 'B', index: 1 }, 1)
    api.detail.get('B').reject(new Error('the read failed'))
    await second

    expect(useAssetDetailStore().asset?.id).toBe('A')
    expect(activeIds()).toEqual(['A'])
    expect(store.getActiveAssetId()).toBe('A')
  })

  it('has no tile marked beside a panel that shows no asset', async () => {
    const { actions, store } = await setup()
    store.setList([asset('A'), asset('B')])

    const clicked = actions.onItemClick({ assetId: 'B', index: 1 }, 1)
    api.detail.get('B').reject(new Error('the read failed'))
    await clicked

    expect(useAssetDetailStore().asset).toBeNull()
    expect(activeIds()).toEqual([])
    expect(store.getActiveAssetId()).toBeNull()
  })

  // The detail "edit" of the panel opened showed one asset, and the list remembered another: that one was read.
  it('reads the asset the detail showed once it has closed, and marks its tile', async () => {
    const { actions, store } = await setup()
    store.setList([asset('A'), asset('B')])
    store.setActiveByIndex(1)

    const afterClose = actions.readActiveItemAgain('A')
    expect(api.detailAsked).toEqual(['A'])
    const asked = api.detailAsked[0]!
    api.detail.get(asked).resolve(asset(asked))
    await afterClose

    expect(useAssetDetailStore().asset?.id).toBe('A')
    expect(activeIds()).toEqual(['A'])
  })
})

describe('an asset a list has twice', () => {
  it('is taken out of the selection by one click, and both of its tiles lose their check', async () => {
    const { store } = await setup()
    store.setMaxCount(5)
    store.setList([asset('A'), asset('B')])
    store.toggleSelectedByIndex(0)
    store.appendList([asset('A')])
    expect(checked()).toEqual([true, false, true])

    store.toggleSelectedByIndex(2)

    expect(checked()).toEqual([false, false, false])
    expect(store.selectedCount).toBe(0)
  })

  it('has its check on both tiles once one of them is clicked, also in a picker of one asset', async () => {
    const { store } = await setup()
    store.setSingleMode(true)
    store.setMaxCount(1)
    store.setList([asset('A'), asset('B'), asset('A')])

    store.toggleSelectedByIndex(2)

    expect(checked()).toEqual([true, false, true])
    expect(store.getSelectedData(AssetSelectReturnType.AssetId, undefined).value).toEqual(['A'])
  })
})

describe('a new list asked for while a list is on its way', () => {
  it('keeps the loader on till it has been read: the list given up does not turn it off', async () => {
    const { actions, store } = await setup()
    const first = actions.fetchAssetListDebounced()
    await vi.waitFor(() => expect(api.list).toHaveLength(1))
    expect(store.loader).toBe(true)

    const second = actions.fetchAssetListDebounced()
    api.list[0].resolve([asset('old')])
    await first
    await flushPromises()

    expect(store.loader).toBe(true)
    await vi.waitFor(() => expect(api.list).toHaveLength(2))
    api.list[1].resolve([asset('new')])
    await second
    expect(store.loader).toBe(false)
    expect(store.assetListItems.map((item) => item.asset.id)).toEqual(['new'])
  })
})

describe('"load more" after a further page that failed', () => {
  /** The button of a list, in the page or in a column of its own that scrolls. */
  const button = (scrolls = false) => {
    const target = document.createElement('button')
    if (!scrolls) {
      document.body.append(target)
      return { target, column: null }
    }
    const column = document.createElement('div')
    column.style.cssText = 'height: 100px; overflow-y: auto'
    const tall = document.createElement('div')
    tall.style.height = '1000px'
    column.append(tall, target)
    document.body.append(column)
    return { target, column }
  }
  const entriesOf = (target: Element) => [{ target } as unknown as IntersectionObserverEntry]
  /** The list has a further page, asks for it, and the DAM fails it. */
  const failedOnce = async (actions: ReturnType<typeof useAssetSelectActions>) => {
    actions.pagination.value.hasNextPage = true
    const failed = actions.fetchNextPage()
    api.list.at(-1).reject(new Error('the page failed'))
    await failed
    actions.pagination.value.hasNextPage = true
  }

  it('does not ask again as the button comes back into view after a change of the layout alone', async () => {
    const { actions } = await setup()
    const { target } = button()
    await failedOnce(actions)

    actions.fetchNextPageInView(false, entriesOf(target))
    actions.fetchNextPageInView(true, entriesOf(target))

    expect(api.list).toHaveLength(1)
  })

  it('asks again as the button comes back into view once the list has been scrolled', async () => {
    const { actions } = await setup()
    const { target, column } = button(true)
    await failedOnce(actions)

    actions.fetchNextPageInView(false, entriesOf(target))
    column!.scrollTop = 600
    actions.fetchNextPageInView(true, entriesOf(target))

    expect(api.list).toHaveLength(2)
  })

  // Each list remembers its own: the button of another list leaving the view and coming back takes nothing from it.
  it('is remembered by the list it failed in', async () => {
    const { actions } = await setup()
    const other = listActions()
    const { target } = button()
    const { target: otherTarget } = button()
    await failedOnce(actions)

    other.fetchNextPageInView(false, entriesOf(otherTarget))
    actions.fetchNextPageInView(true, entriesOf(target))

    expect(api.list).toHaveLength(1)
  })
})
