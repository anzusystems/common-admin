import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserAdminConfigInnerFilter } from '@/domains/filters/bookmarks/filter/UserAdminConfigFilter'
import {
  type UserAdminConfig,
  type UserAdminConfigLayoutTypeType,
  UserAdminConfigType,
} from '@/domains/filters/bookmarks/types/UserAdminConfig'
import type { IntegerId } from '@/shared/types/common'
import type { UseApiFetchListReturnType } from '@/domains/api/composables/useApiFetchList'
import { usePagination } from '@/domains/api/composables/pagination'
import { SortOrder } from '@/domains/api/types/SortOrder'
import { stringSplitOnFirstOccurrence } from '@/shared/utils/string'

interface CacheItem<T = UserAdminConfig> {
  lastUsed: number
  items: T[]
  /**
   * The entry is known to be behind the server. It keeps its rows because
   * the filter bar reads them directly and dropping them would blank it.
   * The next reader is sent to the server instead.
   */
  stale?: boolean
}

const MAX_BOOKMARKS = 3
export const MAX_BOOKMARK_ITEMS = 8

export const useFilterBookmarkStore = defineStore('commonAdminFilterBookmarkStore', () => {
  const bookmarks = ref(new Map<string, CacheItem>())
  const error = ref(false)
  // A forced refetch can be requested again before the first
  // answers, as the bookmark dialog does on every manage tab entry.
  // Only the newest answer per key becomes the cache, or an older one could restore an outdated filter bar.
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
    useApiFetch: () => UseApiFetchListReturnType<UserAdminConfig>,
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
      const { execute } = useApiFetch()
      items = await execute(pagination, filterData, filterConfig)
      if (fetchSequence.get(key) === sequence) {
        bookmarks.value.set(key, { lastUsed: now, items })
      }
    } catch (e) {
      // An overtaken answer, including a failure, says nothing about the newer request.
      if (fetchSequence.get(key) === sequence) {
        error.value = true
        // A forced refetch means something changed, so after a failed one the cache cannot be trusted either.
        markStale(key)
      }
      // `null`, not an empty array, so the caller can tell "no bookmarks" from "request failed".
      // The store has one `error` flag, so it cannot say which request failed.
      return null
    }

    if (bookmarks.value.size > MAX_BOOKMARKS) {
      removeOldestBookmark()
    }

    // Return a copy, never the cached array. `addOne` pushes into the cached array so the filter bar updates at once.
    // A caller that keeps the array, like the manage dialog's editor
    // model, would otherwise get an unsaved row pushed into it.
    return [...items]
  }

  /**
   * Returns the bookmark count, which the cap is checked against, and
   * the highest position in use, which a new bookmark sorts after.
   * These differ. Positions are renumbered only when the manage dialog saves
   * an order, so a row created while another is pending deletion leaves a gap.
   * Deriving the position from the count would then reuse a taken position. The list has no second sort key for ties.
   */
  async function fetchBookmarkStats(
    identifier: {
      user: IntegerId
      layoutType: UserAdminConfigLayoutTypeType
      systemResource: string
    },
    useApiFetch: () => UseApiFetchListReturnType<UserAdminConfig>
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
      const { execute } = useApiFetch()
      // The page is capped one above the user's maximum, so a list long enough
      // to hide the highest position is also one the count refuses to add to.
      // Take the max across rows, not the last row, so this does not depend on the sort order requested above.
      const res = await execute(pagination, filterData, filterConfig)
      return {
        count: res.length,
        maxPosition: res.length > 0 ? Math.max(...res.map((item) => item.position)) : 0,
      }
    } catch (e) {
      error.value = true
      // `Infinity` refuses the add when the count fails, rather than creating a bookmark past an unchecked cap.
      return { count: Infinity, maxPosition: 0 }
    }
  }

  /**
   * A direct write to the cache is newer than any in-flight fetch, so it counts as an answer.
   * Otherwise a fetch issued before the write would return and overwrite the cache, losing the write.
   */
  function supersedeInFlight(key: string) {
    fetchSequence.set(key, (fetchSequence.get(key) ?? 0) + 1)
  }

  function addOne(key: string, data: UserAdminConfig) {
    const cached = bookmarks.value.get(key)
    // Nothing cached means nothing to update. Superseding here
    // would discard an in-flight fetch and leave the bar empty.
    // Missing the new bookmark until the next refresh is the lesser problem.
    if (!cached) return
    cached.items.push(data)
    supersedeInFlight(key)
  }

  /**
   * Removes one bookmark from the cache in place, like `addOne`, so a
   * filter bar already on screen stops offering it. It does not refetch.
   */
  function removeOne(key: string, id: IntegerId) {
    const cached = bookmarks.value.get(key)
    if (!cached) return
    cached.items = cached.items.filter((item) => item.id !== id)
    supersedeInFlight(key)
  }

  /**
   * Marks the cache under this key as behind the server, after a write whose refresh did not happen or failed.
   * Cached rows stay readable. The next read goes to the server.
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
