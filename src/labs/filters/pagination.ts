import { type DatatableSortBy, SortOrder, type SortOrderType } from '@/composables/system/datatableColumns'
import { type Ref, ref } from 'vue'
import { isNull, isString, isUndefined } from '@/utils/common'

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
}

const createDefaultPaginationOptions = () => {
  return {
    rowsPerPage: 25,
  }
}

export function usePagination(
  sortKey: string | null,
  sortOrder: SortOrderType = SortOrder.Desc,
  options: Partial<PaginationOptions> = {},
  externalPaginationRef?: Ref<Pagination>
): UsePaginationReturnType {
  const mergedOptions = { ...createDefaultPaginationOptions(), ...options }

  const pagination =
    externalPaginationRef ??
    ref<Pagination>({
      sortBy: isNull(sortKey) ? null : { key: sortKey, order: sortOrder },
      page: 1,
      rowsPerPage: mergedOptions.rowsPerPage,
      rowsNumber: 0,
      hasNextPage: null,
      currentViewCount: 0,
      totalCount: 0,
    })

  /**
   * Update sorting for the datatable.
   * Supported call variants:
   * 1) setSortBy(sortBy: DatatableSortBy) — pass a DatatableSortBy object
   * 2) setSortBy(sortKey: string, sortOrder: SortOrderType) — pass key and order separately
   */
  function setSortBy(sortBy: DatatableSortBy): void
  function setSortBy(sortKey: string, sortOrder: SortOrderType): void
  function setSortBy(arg1: DatatableSortBy | string, arg2?: SortOrderType): void {
    if (isString(arg1)) {
      pagination.value = { ...pagination.value, sortBy: { key: arg1, order: arg2 as SortOrderType } }
      return
    }

    const sortBy = arg1
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
