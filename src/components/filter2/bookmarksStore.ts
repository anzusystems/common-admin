import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import type { Pagination } from '@/types/Pagination.ts'
import type { FilterConfig, FilterData } from '@/composables/filter/filterFactory.ts'
import { usePagination } from '@/composables/system/pagination.ts'
import { useUserAdminConfigInnerFilter } from '@/components/filter2/UserAdminConfigFilter.ts'
import {
  type UserAdminConfig,
  type UserAdminConfigLayoutTypeType,
  UserAdminConfigType,
} from '@/types/UserAdminConfig.ts'
import type { IntegerId } from '@/types/common.ts'

interface CacheItem<T = UserAdminConfig> {
  lastUsed: number
  items: T[]
}

const MAX_BOOKMARKS = 3
const MAX_BOOKMARK_ITEMS = 25

export const useFilterBookmarkStore = defineStore('filterBookmarkStore', () => {
  const bookmarks = ref(new Map<string, CacheItem>())
  const error = ref(false)

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
      system: string
      user: IntegerId
      layoutType: UserAdminConfigLayoutTypeType
      systemResource: string
    },
    apiFetch: (
      pagination: Pagination,
      filterData: FilterData,
      filterConfig: FilterConfig
    ) => Promise<UserAdminConfig[]>,
    forceFetch: boolean = false
  ): Promise<UserAdminConfig[]> {
    error.value = false
    const key = `${identifier.system}/userAdminConfig/${identifier.layoutType}/${identifier.systemResource}`
    const now = Date.now()

    if (!forceFetch) {
      const cached = bookmarks.value.get(key)
      if (cached) {
        cached.lastUsed = now
        return cached.items
      }
    }

    const pagination = usePagination('position')
    pagination.descending = false
    pagination.rowsPerPage = MAX_BOOKMARK_ITEMS

    const { filterConfig, filterData } = useUserAdminConfigInnerFilter(identifier.system)
    filterData.configType = UserAdminConfigType.Filter
    filterData.layoutType = identifier.layoutType
    filterData.systemResource = identifier.systemResource

    let items: UserAdminConfig[] = []
    try {
      items = await apiFetch(pagination, filterData, filterConfig)
      bookmarks.value.set(key, { lastUsed: now, items })
    } catch (e) {
      error.value = true
    }

    if (bookmarks.value.size > MAX_BOOKMARKS) {
      removeOldestBookmark()
    }

    return items
  }

  return {
    bookmarks,
    error,
    getBookmarks,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFilterBookmarkStore, import.meta.hot))
}
