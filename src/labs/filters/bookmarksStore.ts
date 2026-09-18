import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserAdminConfigInnerFilter } from '@/labs/filters/UserAdminConfigFilter'
import { type UserAdminConfig, type UserAdminConfigLayoutTypeType, UserAdminConfigType } from '@/types/UserAdminConfig'
import type { IntegerId } from '@/types/common'
import type { UseApiFetchListReturnType } from '@/labs/api/useApiFetchList'
import { usePagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import { stringSplitOnFirstOccurrence } from '@/utils/string'

interface CacheItem<T = UserAdminConfig> {
  lastUsed: number
  items: T[]
  /**
   * The entry is known to be behind the server. It keeps its rows -- the filter bar reads them
   * straight out of this map and dropping them would blank it on screen -- but the next reader is
   * sent to the server instead of being handed them as current.
   */
  stale?: boolean
}

const MAX_BOOKMARKS = 3
export const MAX_BOOKMARK_ITEMS = 8

export const useFilterBookmarkStore = defineStore('filterBookmarkStore', () => {
  const bookmarks = ref(new Map<string, CacheItem>())
  const error = ref(false)
  // A forced refetch can be asked for again before the first one has answered -- the bookmark
  // dialog does exactly that on every entry to its manage tab. Only the newest answer per key is
  // allowed to become the cache; an older one landing after it would put the filter bar back to
  // what it showed two refreshes ago.
  const fetchSequence = new Map<string, number>()

  function generateKey(layoutType: UserAdminConfigLayoutTypeType, systemResource: string) {
    return `userAdminConfig/${systemResource}/${layoutType}/`
  }

  function removeOldestBookmark() {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    bookmarks.value.forEach((value, bookmarkKey) => {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed
        oldestKey = bookmarkKey
      }
    })
    if (oldestKey !== null) {
      bookmarks.value.delete(oldestKey)
    }
  }

  async function getBookmarks(
    identifier: {
      user: IntegerId
      layoutType: UserAdminConfigLayoutTypeType
      systemResource: string
    },
    useApiFetch: () => UseApiFetchListReturnType<UserAdminConfig[]>,
    forceFetch: boolean = false
  ): Promise<UserAdminConfig[] | null> {
    error.value = false
    const key = generateKey(identifier.layoutType, identifier.systemResource)
    const now = Date.now()

    if (!forceFetch) {
      const cached = bookmarks.value.get(key)
      if (cached && !cached.stale) {
        cached.lastUsed = now
        return [...cached.items]
      }
    }

    const { pagination } = usePagination('position', SortOrder.Asc, {
      rowsPerPage: MAX_BOOKMARK_ITEMS,
    })
    const { start: system, end: resource } = stringSplitOnFirstOccurrence(identifier.systemResource, '_')
    const { filterConfig, filterData } = useUserAdminConfigInnerFilter(system, resource)
    filterData.configType = UserAdminConfigType.FilterBookmark
    filterData.layoutType = identifier.layoutType
    filterData.systemResource = identifier.systemResource
    filterData.user = identifier.user

    const sequence = (fetchSequence.get(key) ?? 0) + 1
    fetchSequence.set(key, sequence)

    let items: UserAdminConfig[]
    try {
      const { executeFetch } = useApiFetch()
      items = await executeFetch(pagination, filterData, filterConfig)
      if (fetchSequence.get(key) === sequence) {
        bookmarks.value.set(key, { lastUsed: now, items })
      }
    } catch (e) {
      // An overtaken answer says nothing about the newer one that replaced it, failure included.
      if (fetchSequence.get(key) === sequence) {
        error.value = true
        // A forced refetch is asked for because something is known to have changed, so a failed one
        // leaves nothing to trust in the cache either.
        markStale(key)
      }
      // `null`, not an empty array: "there are no bookmarks" and "this request died" are different
      // answers, and the caller can only tell them apart if they look different. The `error` flag is
      // one per store, so it cannot say which request it belongs to.
      return null
    }

    if (bookmarks.value.size > MAX_BOOKMARKS) {
      removeOldestBookmark()
    }

    // A copy, never the array the cache holds. `addOne` pushes into that one so the filter bar
    // picks the new bookmark up on the spot, and a caller that keeps what it was handed -- the
    // manage dialog keeps it as its editor's model -- would otherwise get that row pushed into its
    // list from the outside, where it reads as something the user added and never saved.
    return [...items]
  }

  /**
   * What a new bookmark needs to know: how many there are, which is what the cap is checked
   * against, and the highest position in use, which is what it has to sort after.
   *
   * The two are not the same number. Positions go dense only when the manage dialog saves an
   * order -- it renumbers exactly the rows it sends -- so a row created while another was pending
   * deletion leaves a gap behind, and from then on the count is lower than the highest position.
   * Deriving a new position from the count would then hand it one already in use: two rows on the
   * same position, which the list has no second key to order by, or with more than one deletion a
   * position below a row created earlier.
   */
  async function fetchBookmarkStats(
    identifier: {
      user: IntegerId
      layoutType: UserAdminConfigLayoutTypeType
      systemResource: string
    },
    useApiFetch: () => UseApiFetchListReturnType<UserAdminConfig[]>
  ): Promise<{ count: number; maxPosition: number }> {
    error.value = false
    const { pagination } = usePagination('position', SortOrder.Asc, {
      rowsPerPage: MAX_BOOKMARK_ITEMS + 1,
    })
    const { start: system, end: resource } = stringSplitOnFirstOccurrence(identifier.systemResource, '_')
    const { filterConfig, filterData } = useUserAdminConfigInnerFilter(system, resource)
    filterData.configType = UserAdminConfigType.FilterBookmark
    filterData.layoutType = identifier.layoutType
    filterData.systemResource = identifier.systemResource
    filterData.user = identifier.user

    try {
      const { executeFetch } = useApiFetch()
      // The page is capped one above the maximum a user may have, so a list long enough to hide the
      // real highest position is also one the count refuses to add to. Read across the rows rather
      // than off the last one: taking the last would tie this to the sort order asked for above,
      // and flipping that would quietly turn the highest position into the lowest -- with nothing
      // to show for it, since the order the bar draws comes from a different call.
      const res = await executeFetch(pagination, filterData, filterConfig)
      return {
        count: res.length,
        maxPosition: res.length > 0 ? Math.max(...res.map((item) => item.position)) : 0,
      }
    } catch (e) {
      error.value = true
      // `Infinity` keeps what a failed count has always done: refuse the add rather than create a
      // bookmark past a cap nobody could check.
      return { count: Infinity, maxPosition: 0 }
    }
  }

  /**
   * A write straight into what is cached is newer than any answer already on its way, so it counts
   * as an answer of its own. Without this an in-flight fetch -- issued before the write, so its
   * rows know nothing about it -- would come back and overwrite the cache, taking the write with
   * it, and only the next forced fetch would bring it back.
   */
  function supersedeInFlight(key: string) {
    fetchSequence.set(key, (fetchSequence.get(key) ?? 0) + 1)
  }

  function addOne(key: string, data: UserAdminConfig) {
    const cached = bookmarks.value.get(key)
    // Nothing cached means nothing to add to and nothing to protect: superseding here would throw
    // away the answer of a fetch already on its way and leave the bar with no bookmarks at all,
    // which is worse than it missing the one just created until the next refresh brings it.
    if (!cached) return
    cached.items.push(data)
    supersedeInFlight(key)
  }

  /**
   * Drop one bookmark from what is cached, in place, the way `addOne` adds one -- so a delete that
   * went through stops being offered by a filter bar that is already on screen. It reads this map
   * straight and does not fetch again for itself.
   */
  function removeOne(key: string, id: IntegerId) {
    const cached = bookmarks.value.get(key)
    if (!cached) return
    cached.items = cached.items.filter((item) => item.id !== id)
    supersedeInFlight(key)
  }

  /**
   * Say that what is cached under this key is behind the server -- after a write whose refresh did
   * not happen, or one that failed. The rows stay readable for whoever is already showing them; the
   * next read goes to the server.
   */
  function markStale(key: string) {
    const cached = bookmarks.value.get(key)
    if (cached) cached.stale = true
  }

  return {
    bookmarks,
    error,
    getBookmarks,
    generateKey,
    addOne,
    removeOne,
    markStale,
    fetchBookmarkStats,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFilterBookmarkStore, import.meta.hot))
}
