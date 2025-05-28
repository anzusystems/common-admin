import type { DatatableSortBy } from '@/composables/system/datatableColumns'
import { ref } from 'vue'

export interface Pagination {
  sortBy: DatatableSortBy
  page: number
  rowsPerPage: number
  rowsNumber: number
  hasNextPage: null | boolean
  currentViewCount: number
  totalCount: number
}

export function usePagination(sortBy: DatatableSortBy = null) {
  return ref<Pagination>({
    sortBy,
    page: 1,
    rowsPerPage: 25,
    rowsNumber: 0,
    hasNextPage: null,
    currentViewCount: 0,
    totalCount: 0,
  })
}
