import type { DatatableSortBy } from '@/composables/system/datatableColumns.ts'

export interface Pagination {
  sortBy: string | null
  descending: boolean
  page: number
  rowsPerPage: number
  rowsNumber: number
  hasNextPage: null | boolean
  currentViewCount: number
  totalCount: number
}

export interface Pagination2 {
  sortBy: DatatableSortBy
  page: number
  rowsPerPage: number
  rowsNumber: number
  hasNextPage: null | boolean
  currentViewCount: number
  totalCount: number
}
