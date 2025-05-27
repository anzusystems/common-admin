import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserAdminConfigInnerFilter } from '@/labs/filters/UserAdminConfigFilter'
import {
  type UserAdminConfig,
  type UserAdminConfigLayoutTypeType,
  UserAdminConfigType,
} from '@/types/UserAdminConfig'
import type { IntegerId } from '@/types/common'
import type { UseApiFetchListReturnType } from '@/labs/api/useApiFetchList'
import { END_POINT } from '@/services/api/userAdminConfig/userAdminConfig'
import { usePagination } from '@/labs/filters/pagination'

interface CacheItem<T = UserAdminConfig> {
  lastUsed: number
  items: T[]
}

const MAX_BOOKMARKS = 3
export const MAX_BOOKMARK_ITEMS = 8

export const useFilterBookmarkStore = defineStore('filterBookmarkStore', () => {
  const bookmarks = ref(new Map<string, CacheItem>())
  const error = ref(false)

  function generateKey(system: string, layoutType: UserAdminConfigLayoutTypeType, systemResource: string) {
    return `${system}/userAdminConfig/${layoutType}/${systemResource}`
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
      system: string
      user: IntegerId
      layoutType: UserAdminConfigLayoutTypeType
      systemResource: string
    },
    useApiFetch: () => UseApiFetchListReturnType<UserAdminConfig[]>,
    forceFetch: boolean = false
  ): Promise<UserAdminConfig[]> {
    error.value = false
    const key = generateKey(identifier.system, identifier.layoutType, identifier.systemResource)
    const now = Date.now()

    if (!forceFetch) {
      const cached = bookmarks.value.get(key)
      if (cached) {
        cached.lastUsed = now
        return cached.items
      }
    }

    const pagination = usePagination({ key: 'position', order: 'asc' })
    pagination.value.rowsPerPage = MAX_BOOKMARK_ITEMS

    const { filterConfig, filterData } = useUserAdminConfigInnerFilter(identifier.system)
    filterData.configType = UserAdminConfigType.FilterBookmark
    filterData.layoutType = identifier.layoutType
    filterData.systemResource = identifier.systemResource

    let items: UserAdminConfig[] = []
    try {
      const { executeFetch } = useApiFetch()
      items = await executeFetch(pagination, filterData, filterConfig, END_POINT)
      bookmarks.value.set(key, { lastUsed: now, items })
    } catch (e) {
      error.value = true
    }

    if (bookmarks.value.size > MAX_BOOKMARKS) {
      removeOldestBookmark()
    }

    return items
  }

  async function fetchBookmarksCount(
    identifier: {
      system: string
      user: IntegerId
      layoutType: UserAdminConfigLayoutTypeType
      systemResource: string
    },
    useApiFetch: () => UseApiFetchListReturnType<UserAdminConfig[]>
  ): Promise<number> {
    error.value = false
    const pagination = usePagination({ key: 'position', order: 'asc' })
    pagination.value.rowsPerPage = MAX_BOOKMARK_ITEMS + 1

    const { filterConfig, filterData } = useUserAdminConfigInnerFilter(identifier.system)
    filterData.configType = UserAdminConfigType.FilterBookmark
    filterData.layoutType = identifier.layoutType
    filterData.systemResource = identifier.systemResource

    let length = Infinity
    try {
      const { executeFetch } = useApiFetch()
      const res = await executeFetch(pagination, filterData, filterConfig, END_POINT)
      length = res.length
    } catch (e) {
      error.value = true
    }

    return length
  }

  function addOne(key: string, data: UserAdminConfig) {
    bookmarks.value.get(key)?.items.push(data)
  }

  return {
    bookmarks,
    error,
    getBookmarks,
    generateKey,
    addOne,
    fetchBookmarksCount,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFilterBookmarkStore, import.meta.hot))
}
