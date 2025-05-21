import { ref } from 'vue'
import type { Pagination } from '@/types/Pagination'

export function usePagination2(sortBy: string | null = null) {
  return ref<Pagination>({
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
