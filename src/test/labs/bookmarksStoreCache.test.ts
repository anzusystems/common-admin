import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFilterBookmarkStore } from '@/labs/filters/bookmarksStore'
import { type UserAdminConfig, UserAdminConfigLayoutType } from '@/types/UserAdminConfig'

// The bookmark cache is what the filter bar reads its saved filters out of, and the manage dialog
// is what writes them. The bar reads this map straight and never fetches for itself, so what the
// cache does with a failure, with two answers in flight at once, and with a write of its own is
// the part worth pinning.

const identifier = {
  user: 7,
  layoutType: UserAdminConfigLayoutType.Desktop,
  systemResource: 'cms_article',
}

const bookmark = (id: number, customName: string): UserAdminConfig =>
  ({ id, customName, position: id, data: {} }) as unknown as UserAdminConfig

const fetcher = (executeFetch: () => Promise<UserAdminConfig[]>) => () => ({ executeFetch }) as never

describe('the bookmark cache', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('serves what it holds until a fetch is forced', async () => {
    const store = useFilterBookmarkStore()
    const first = vi.fn(async () => [bookmark(1, 'First')])
    await store.getBookmarks(identifier, fetcher(first))

    const second = vi.fn(async () => [bookmark(1, 'Renamed')])
    const cached = await store.getBookmarks(identifier, fetcher(second))

    expect(second).not.toHaveBeenCalled()
    expect(cached?.map((item) => item.customName)).toEqual(['First'])
  })

  it('keeps its rows after a failed refetch but stops handing them out as current', async () => {
    const store = useFilterBookmarkStore()
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )
    expect(store.error).toBe(false)
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    const failed = await store.getBookmarks(
      identifier,
      fetcher(async () => {
        throw new Error('backend is down')
      }),
      true
    )
    // Its own answer, not the store-wide flag: that one is shared with every other fetch the store
    // serves, so a caller cannot tell from it whether ITS request is the one that died.
    expect(failed).toBeNull()
    expect(store.error).toBe(true)

    // The filter bar reads this map straight and never fetches for itself, so dropping the entry
    // would blank the bookmarks on screen the moment a background refresh failed.
    expect(store.bookmarks.get(key)?.items.map((item) => item.customName)).toEqual(['First'])

    // A refetch is asked for because something is known to have changed, so a failed one is not a
    // reason to keep serving what it was going to replace.
    const retry = vi.fn(async () => [bookmark(1, 'Renamed')])
    const items = await store.getBookmarks(identifier, fetcher(retry))

    expect(retry).toHaveBeenCalledTimes(1)
    expect(items?.map((item) => item.customName)).toEqual(['Renamed'])
  })

  it('lets only the newest refetch become the cache', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    // Two forced refetches for the same key, the first one slower: the bookmark dialog asks for one
    // on every entry to its manage tab, and the tabs switch faster than a request comes back.
    let releaseOlder = () => {}
    const older = store.getBookmarks(
      identifier,
      fetcher(async () => {
        await new Promise<void>((resolve) => (releaseOlder = () => resolve()))
        return [bookmark(1, 'Stale')]
      }),
      true
    )
    const newer = store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'Fresh')]),
      true
    )

    await newer
    expect(store.bookmarks.get(key)?.items.map((item) => item.customName)).toEqual(['Fresh'])

    releaseOlder()
    await older

    // The filter bar renders straight out of this map, so an overtaken answer landing late would
    // put it back to what it showed a refresh ago.
    expect(store.bookmarks.get(key)?.items.map((item) => item.customName)).toEqual(['Fresh'])
  })

  it('never hands out the array it keeps', async () => {
    const store = useFilterBookmarkStore()
    const items = await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    // `addOne` pushes into the cached array on purpose, so that a filter bar already on screen
    // shows the new bookmark at once. A caller holding what it was handed must not have rows
    // appear in it from the outside -- the manage dialog keeps that array as its editor's model,
    // and a row arriving there reads as something the user added and has not saved.
    store.addOne(key, bookmark(2, 'Second'))

    expect(items?.map((item) => item.id)).toEqual([1])
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1, 2])

    // The same for a read served out of the cache.
    const cached = await store.getBookmarks(
      identifier,
      fetcher(async () => [])
    )
    store.addOne(key, bookmark(3, 'Third'))
    expect(cached?.map((item) => item.id)).toEqual([1, 2])
  })

  it('takes one bookmark out of what it holds, in place', async () => {
    const store = useFilterBookmarkStore()
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First'), bookmark(2, 'Second')])
    )
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    store.removeOne(key, 2)

    // In place, because the filter bar renders straight out of this map: a bookmark whose delete
    // went through must stop being offered without waiting for anything to be refetched.
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1])
  })

  it('sends the next reader to the server once it is told it is behind', async () => {
    const store = useFilterBookmarkStore()
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )

    // What a save that wrote something and could not finish refreshing says.
    store.markStale(store.generateKey(identifier.layoutType, identifier.systemResource))

    const retry = vi.fn(async () => [bookmark(1, 'Renamed')])
    const items = await store.getBookmarks(identifier, fetcher(retry))

    expect(retry).toHaveBeenCalledTimes(1)
    expect(items?.map((item) => item.customName)).toEqual(['Renamed'])
  })

  it('does not let an overtaken failure speak for the answer that replaced it', async () => {
    const store = useFilterBookmarkStore()
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )

    let failOlder = () => {}
    const older = store.getBookmarks(
      identifier,
      fetcher(async () => {
        await new Promise<void>((resolve) => (failOlder = () => resolve()))
        throw new Error('backend is down')
      }),
      true
    )
    const newer = await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'Fresh')]),
      true
    )
    expect(newer?.map((item) => item.customName)).toEqual(['Fresh'])

    failOlder()
    await older

    // The newer answer is the current one, and it worked: marking the entry stale or raising the
    // error flag here would send the next reader back to the server for nothing.
    expect(store.error).toBe(false)
    const after = vi.fn(async () => [bookmark(1, 'Refetched')])
    const served = await store.getBookmarks(identifier, fetcher(after))
    expect(after).not.toHaveBeenCalled()
    expect(served?.map((item) => item.customName)).toEqual(['Fresh'])
  })

  it('does not let a fetch already on its way undo a bookmark added while it was out', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )

    // A refresh goes out, and while it is out the user creates a bookmark on the other tab. The
    // rows that refresh is carrying were read before that happened.
    let release = () => {}
    const refresh = store.getBookmarks(
      identifier,
      fetcher(async () => {
        await new Promise<void>((resolve) => (release = () => resolve()))
        return [bookmark(1, 'First')]
      }),
      true
    )
    store.addOne(key, bookmark(99, 'Just created'))

    release()
    await refresh

    // The server has it; letting the older answer land would take it out of the bar until something
    // forced another fetch.
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1, 99])
  })

  it('lets a first fetch land even when a bookmark was created while it was out', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    // Nothing cached yet: this is the filter bar's own first load. `addOne` has nothing to add to.
    let release = () => {}
    const first = store.getBookmarks(
      identifier,
      fetcher(async () => {
        await new Promise<void>((resolve) => (release = () => resolve()))
        return [bookmark(1, 'First')]
      })
    )
    store.addOne(key, bookmark(99, 'Just created'))

    release()
    await first

    // Discarding this answer would leave the bar with no bookmarks at all, and it does not fetch
    // again for itself. Missing the one just created until the next refresh is the smaller loss.
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1])
  })

  it('does not let a fetch already on its way bring back a bookmark that was deleted', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First'), bookmark(2, 'Second')])
    )

    // The mirror of the added-while-out case. The dialog cannot reach it today -- it refuses to
    // start a save while a refresh is out, and finishes with a fetch of its own -- but the rule
    // belongs to the store, which is where the next caller will find it.
    let release = () => {}
    const refresh = store.getBookmarks(
      identifier,
      fetcher(async () => {
        await new Promise<void>((resolve) => (release = () => resolve()))
        return [bookmark(1, 'First'), bookmark(2, 'Second')]
      }),
      true
    )
    store.removeOne(key, 2)

    release()
    await refresh

    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1])
  })
})
