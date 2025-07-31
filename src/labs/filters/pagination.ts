import type { DatatableSortBy } from '@/composables/system/datatableColumns'
import { type Ref, ref } from 'vue'
import { isNull, isUndefined } from '@/utils/common.ts'

export interface Pagination {
  sortBy: DatatableSortBy
  page: number
  rowsPerPage: number
  rowsNumber: number
  hasNextPage: null | boolean
  currentViewCount: number
  totalCount: number
}

interface PaginationOptions {
  rowsPerPage: number
  sortBy: DatatableSortBy
}

const PaginationOptionsDefault = {
  rowsPerPage: 25,
  sortBy: null,
}

export function usePagination(
  options: Partial<PaginationOptions> = {},
  externalPaginationRef?: Ref<Pagination>
): UsePaginationReturnType {
  const mergedOptions = { ...PaginationOptionsDefault, ...options }

  const pagination =
    externalPaginationRef ??
    ref<Pagination>({
      sortBy: mergedOptions.sortBy,
      page: 1,
      rowsPerPage: mergedOptions.rowsPerPage,
      rowsNumber: 0,
      hasNextPage: null,
      currentViewCount: 0,
      totalCount: 0,
    })

  const setSortBy = (sortBy: DatatableSortBy) => {
    if (isNull(sortBy) || isUndefined(sortBy)) {
      pagination.value = { ...pagination.value, sortBy }
      return
    }
    pagination.value = { ...pagination.value, sortBy: { key: sortBy.key, order: sortBy.order } }
  }

  const setPage = (page: number) => {
    pagination.value = { ...pagination.value, page }
  }

  const incrementPage = () => {
    pagination.value = { ...pagination.value, page: pagination.value.page + 1 }
    return pagination.value.page
  }

  return {
    pagination,
    setSortBy,
    setPage,
    incrementPage,
  }
}

interface UsePaginationReturnType {
  pagination: Ref<Pagination>
  setSortBy: (sortBy: DatatableSortBy) => void
  setPage: (page: number) => void
  incrementPage: () => number
}
