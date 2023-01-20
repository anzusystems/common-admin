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
