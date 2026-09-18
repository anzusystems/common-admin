import { computed, reactive } from 'vue'
import type { Pagination } from '@/types/Pagination'

export function usePagination(sortBy: string | null = 'id', sortDescending: boolean = true) {
  return reactive<Pagination>({
    sortBy: sortBy,
    descending: sortDescending,
    page: 1,
    rowsPerPage: 25,
    rowsNumber: 0,
    hasNextPage: null,
    currentViewCount: 0,
    totalCount: 0,
  })
}

/**
 * @deprecated No labs replacement exists. Until one does, inline the predicate: see
 * `admin-blog` `NoteDatatable.vue`, which computes it from a labs `Ref<Pagination>` in three lines.
 */
export function usePaginationAutoHide(pagination: Pagination) {
  const showPagination = computed(() => {
    if (pagination.page === 1 && pagination.currentViewCount < pagination.rowsPerPage) return false
    return true
  })

  return {
    showPagination,
  }
}
