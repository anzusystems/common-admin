export const DATETIME_AUTO_LABEL_TRACKING = ['createdAt', 'modifiedAt']

export const SORT_BY_SCORE = '_score'
export const SORT_BY_ID = 'id'
export const SORT_BY_SCORE_DATE = 'score_date'
export const SORT_BY_SCORE_BEST = 'score_best'
export const SortOrder = {
  Asc: 'asc',
  Desc: 'desc',
} as const
export type SortOrderType = (typeof SortOrder)[keyof typeof SortOrder]

export type DatatableSortBy =
  | {
      key: string
      order: SortOrderType
    }
  | null
  | undefined

export type DatatableOrderingOption = {
  id: number
  titleT: string
  sortBy?: DatatableSortBy
  customData?: any
}

export type DatatableOrderingOptions = Array<DatatableOrderingOption>

export type ColumnConfig = {
  key: string
  title?: string
  sortable?: boolean
  fixed?: boolean
  maxWidth?: number
}

export type ColumnInternalValues = {
  key: string
  title?: string
  sortable: boolean
  fixed: boolean
}

export type StoredData = {
  hidden?: string[]
}
