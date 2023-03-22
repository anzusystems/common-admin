import { computed, ref } from 'vue'
import { i18n } from '@/plugins/i18n'
import type { Pagination } from '@/types/Pagination'
import { usePagination } from '@/composables/system/pagination'
import { isUndefined } from '@/utils/common'

export const DATETIME_AUTO_LABEL_TRACKING = ['createdAt', 'modifiedAt']

const { t } = i18n.global || i18n

export type DatatableSortBy =
  | {
      key: string
      order: 'asc' | 'desc'
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
}

export type ColumnInternalValues = {
  key: string
  title?: string
  sortable: boolean
  fixed: boolean
}

const defaultColumn: ColumnInternalValues = {
  key: '',
  title: undefined,
  sortable: false,
  fixed: false,
}

export function createDatatableColumnsConfig(
  config: ColumnConfig[],
  hidden: string[],
  system: string | undefined = undefined,
  subject: string | undefined = undefined,
  disableActions: boolean = false,
  customPagination: Pagination | undefined = undefined
) {
  const pagination: Pagination = usePagination()
  if (customPagination) {
    for (const prop of Object.keys(pagination)) {
      if (prop in customPagination) {
        // @ts-ignore
        pagination[prop] = customPagination[prop]
      }
    }
  }
  const columnsHidden = ref(hidden)

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
    columnsAll.forEach((column) => {
      if (!columnsHidden.value.includes(column.key)) {
        columns.push(column)
      }
    })
    if (!disableActions) columns.push({ key: 'actions', sortable: false, fixed: true })
    return columns
  })

  const updateSortBy = (sortBy: any) => {
    if (sortBy) {
      pagination.sortBy = sortBy.key
      pagination.descending = sortBy.order === 'desc' ? true : false
      return
    }
    pagination.sortBy = null
  }

  return {
    columnsAll,
    columnsVisible,
    columnsHidden,
    updateSortBy,
    pagination,
  }
}
