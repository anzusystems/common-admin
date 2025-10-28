import { computed, onMounted, type Ref, watch } from 'vue'
import { i18n } from '@/plugins/i18n'
import type { Pagination } from '@/types/Pagination'
import { usePagination } from '@/composables/system/pagination'
import { isArray, isObject, isUndefined } from '@/utils/common'

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

export type DatatableOrderingOption = { id: number; titleT: string; sortBy?: DatatableSortBy; customData?: any }

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

const defaultColumn: ColumnInternalValues = {
  key: '',
  title: undefined,
  sortable: false,
  fixed: false,
}

export function createDatatableColumnsConfig(
  config: ColumnConfig[],
  columnsHidden: Ref<Array<string>>,
  system: string | undefined = undefined,
  subject: string | undefined = undefined,
  disableActions: boolean = false,
  customInitialPagination: Pagination | undefined = undefined,
  customI18n: undefined | any = undefined,
  showExpand: undefined | boolean = undefined,
  storeId: string | undefined = undefined
) {
  const localI18n = customI18n ?? i18n
  const { t } = localI18n.global || localI18n
  const pagination: Pagination = usePagination()
  if (customInitialPagination) {
    for (const prop of Object.keys(pagination)) {
      if (prop in customInitialPagination) {
        // @ts-ignore
        pagination[prop] = customInitialPagination[prop]
      }
    }
  }

  const columnsAll = config.map((item) => {
    const obj = { ...defaultColumn, ...item }
    if (!isUndefined(obj.title)) {
      // do not modify
    } else if (isUndefined(obj.title) && DATETIME_AUTO_LABEL_TRACKING.includes(obj.key)) {
      obj.title = t('common.model.tracking.' + obj.key)
    } else if (isUndefined(obj.title) && system && subject) {
      obj.title = t(system + '.' + subject + '.model.' + obj.key)
    } else {
      obj.title = ''
    }
    return obj
  })

  const columnsVisible = computed(() => {
    const columns: any = []
    if (showExpand) columns.push({ key: 'data-table-expand', sortable: false })
    columnsAll.forEach((column) => {
      if (!columnsHidden.value.includes(column.key)) {
        columns.push(column)
      }
    })
    if (!disableActions) columns.push({ key: 'actions', sortable: false, fixed: true })
    return columns
  })

  const updateSortBy = (sortBy: { key: string; order: SortOrderType } | undefined | null) => {
    if (!sortBy) {
      pagination.sortBy = null
      return
    }
    pagination.sortBy = sortBy.key
    pagination.descending = sortBy.order === SortOrder.Desc ? true : false
  }

  const loadStoredColumns = () => {
    if (!storeId || !localStorage) return
    const stored = localStorage.getItem(storeId)
    if (!stored) return
    const storedData = JSON.parse(stored) as StoredData
    if (!isObject(storedData)) return
    if (!isArray(storedData.hidden)) return
    columnsHidden.value = storedData.hidden as string[]
  }

  const storeColumns = (columns: string[]) => {
    if (!storeId || !localStorage) return
    localStorage.setItem(storeId, JSON.stringify({ hidden: columns }))
  }

  onMounted(() => {
    loadStoredColumns()
  })

  watch(columnsHidden, (newValue) => {
    storeColumns(newValue)
  })

  return {
    columnsAll,
    columnsVisible,
    columnsHidden,
    updateSortBy,
    pagination,
  }
}
