import { computed, reactive } from 'vue'
import type { Pagination } from '@/types/Pagination'

export function usePagination(sortBy: string | null = null) {
  return reactive<Pagination>({
    sortBy: sortBy,
    descending: true,
    page: 1,
    rowsPerPage: 25,
    rowsNumber: 0,
    hasNextPage: null,
    currentViewCount: 0,
    totalCount: 0,
  })
}

export function usePaginationAutoHide(pagination: Pagination) {
  const showPagination = computed(() => {
    if (pagination.page === 1 && pagination.currentViewCount < pagination.rowsPerPage) return false
    return true
  })

  return {
    showPagination,
  }
}
