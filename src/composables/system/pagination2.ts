import { ref } from 'vue'
import type { Pagination2 } from '@/types/Pagination'
import type { DatatableSortBy } from '@/composables/system/datatableColumns'

export function usePagination2(sortBy: DatatableSortBy = null) {
  return ref<Pagination2>({
    sortBy,
    page: 1,
    rowsPerPage: 25,
    rowsNumber: 0,
    hasNextPage: null,
    currentViewCount: 0,
    totalCount: 0,
  })
}
