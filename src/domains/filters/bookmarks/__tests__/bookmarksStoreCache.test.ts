import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFilterBookmarkStore } from '@/domains/filters/bookmarks/store/bookmarksStore'
import { type UserAdminConfig, UserAdminConfigLayoutType } from '@/domains/filters/bookmarks/types/UserAdminConfig'

// The filter bar reads saved filters from this cache and never fetches for itself.
// The manage dialog writes them.
// Pinned here: failure handling, two answers in flight, and the cache's own writes.

const identifier = {
  user: 7,
  layoutType: UserAdminConfigLayoutType.Desktop,
  systemResource: 'cms_article',
}

const bookmark = (id: number, customName: string): UserAdminConfig =>
  ({ id, customName, position: id, data: {} }) as unknown as UserAdminConfig

const fetcher = (execute: () => Promise<UserAdminConfig[]>) => () => ({ execute }) as never

// Answers in the order the call asked for, like the endpoint, not in the order the test lists the rows.
// The store reads the highest position across all rows, so the order must not change the answer.
const orderedFetcher = (rows: UserAdminConfig[]) => () =>
  ({
    execute: async (pagination: { value: { sortBy: { key: string; order: string } | null } }) => {
      const ascending = [...rows].sort((a, b) => a.position - b.position)
      return pagination.value.sortBy?.order === 'desc' ? ascending.reverse() : ascending
    },
  }) as never

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
    // Use the call's own answer, not the store-wide flag.
    // That flag is shared with every other fetch, so a caller cannot tell from it whether its own request failed.
    expect(failed).toBeNull()
    expect(store.error).toBe(true)

    // The filter bar reads this map directly and never fetches.
    // Dropping the entry would blank the bookmarks on screen when a background refresh fails.
    expect(store.bookmarks.get(key)?.items.map((item) => item.customName)).toEqual(['First'])

    // A refetch is requested because something is known to have changed.
    // A failed one is no reason to keep serving the data it was meant to replace.
    const retry = vi.fn(async () => [bookmark(1, 'Renamed')])
    const items = await store.getBookmarks(identifier, fetcher(retry))

    expect(retry).toHaveBeenCalledTimes(1)
    expect(items?.map((item) => item.customName)).toEqual(['Renamed'])
  })

  it('lets only the newest refetch become the cache', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    // Two forced refetches for the same key, the first one slower.
    // The dialog forces one on every entry to its manage tab, and tabs switch faster than a request returns.
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

    // The filter bar renders straight from this map.
    // A late overtaken answer would put it back to an older state.
    expect(store.bookmarks.get(key)?.items.map((item) => item.customName)).toEqual(['Fresh'])
  })

  it('never hands out the array it keeps', async () => {
    const store = useFilterBookmarkStore()
    const items = await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    // `addOne` pushes into the cached array on purpose, so a filter bar on screen shows the new bookmark at once.
    // A caller holding the returned array must not see rows appear in it.
    // The manage dialog uses that array as its editor model, and a new row would read as unsaved user work.
    store.addOne(key, bookmark(2, 'Second'))

    expect(items?.map((item) => item.id)).toEqual([1])
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1, 2])

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

    // Removed in place because the filter bar renders straight from this map.
    // A deleted bookmark must stop being offered without waiting for a refetch.
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1])
  })

  it('sends the next reader to the server once it is told it is behind', async () => {
    const store = useFilterBookmarkStore()
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First')])
    )

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

    // The newer answer is current and succeeded.
    // Marking the entry stale or raising the error flag would send the next reader to the server for nothing.
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

    // A refresh is out, and meanwhile the user creates a bookmark on the other tab.
    // The rows the refresh carries were read before that.
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

    // The server has the new bookmark.
    // Letting the older answer land would remove it from the bar until another fetch is forced.
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1, 99])
  })

  it('lets a first fetch land even when a bookmark was created while it was out', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)

    // Nothing is cached yet: this is the filter bar's first load, so `addOne` has nothing to add to.
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

    // Discarding this answer would leave the bar with no bookmarks, and it does not fetch again by itself.
    // Missing the just-created one until the next refresh is the smaller loss.
    expect(store.bookmarks.get(key)?.items.map((item) => item.id)).toEqual([1])
  })

  it('does not let a fetch already on its way bring back a bookmark that was deleted', async () => {
    const store = useFilterBookmarkStore()
    const key = store.generateKey(identifier.layoutType, identifier.systemResource)
    await store.getBookmarks(
      identifier,
      fetcher(async () => [bookmark(1, 'First'), bookmark(2, 'Second')])
    )

    // Mirror of the added-while-out case.
    // The dialog cannot reach it today: it refuses to save while a refresh is out and finishes with its own fetch.
    // The rule belongs to the store, where the next caller will find it.
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

  it('reports the highest position in use, not how many rows there are', async () => {
    const store = useFilterBookmarkStore()
    // A save that deleted a row leaves a gap.
    // The manage tab renumbers only the rows it sends, so a row
    // created while another was pending deletion keeps its position.
    const withGap = [
      { ...bookmark(1, 'First'), position: 1 },
      { ...bookmark(3, 'Third'), position: 2 },
      { ...bookmark(9, 'Created earlier'), position: 4 },
    ] as UserAdminConfig[]

    const stats = await store.fetchBookmarkStats(identifier, orderedFetcher(withGap))

    // Counting rows would give the next bookmark position 4, which the last row already holds.
    // The list has no second key to order two rows on the same position.
    expect(stats).toEqual({ count: 3, maxPosition: 4 })
  })

  it('refuses the add when it cannot count', async () => {
    const store = useFilterBookmarkStore()

    const stats = await store.fetchBookmarkStats(
      identifier,
      fetcher(async () => {
        throw new Error('backend is down')
      })
    )

    // `Infinity` is what the cap is compared against.
    // A failed count blocks the add instead of creating a bookmark past a limit nobody could check.
    expect(stats.count).toBe(Infinity)
    expect(store.error).toBe(true)
  })

  it('starts at one when there are no bookmarks yet', async () => {
    const store = useFilterBookmarkStore()

    const stats = await store.fetchBookmarkStats(identifier, orderedFetcher([]))

    // The caller adds one to the highest position, so an empty list must answer zero.
    // `undefined` would make the first position `NaN`.
    expect(stats).toEqual({ count: 0, maxPosition: 0 })
  })
})
