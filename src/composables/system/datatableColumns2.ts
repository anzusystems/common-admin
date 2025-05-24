import { computed, onMounted, type Ref, watch } from 'vue'
import { i18n } from '@/plugins/i18n'
import { isArray, isObject, isUndefined } from '@/utils/common'
import {
  type ColumnConfig, type ColumnInternalValues,
  DATETIME_AUTO_LABEL_TRACKING,
  type StoredData,
} from '@/composables/system/datatableColumns'

const defaultColumn: ColumnInternalValues = {
  key: '',
  title: undefined,
  sortable: false,
  fixed: false,
}

export function createDatatableColumnsConfig2(
  config: ColumnConfig[],
  columnsHidden: Ref<Array<string>>,
  system: string | undefined = undefined,
  subject: string | undefined = undefined,
  disableActions: boolean = false,
  customI18n: undefined | any = undefined,
  showExpand: undefined | boolean = undefined,
  storeId: string | undefined = undefined
) {
  const localI18n = customI18n ?? i18n
  const { t } = localI18n.global || localI18n

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

  // const updateSortBy = (sortBy: { key: string; order: 'asc' | 'desc' } | undefined | null) => {
  //   if (!sortBy) {
  //     pagination.sortBy = null
  //     return
  //   }
  //   pagination.sortBy = sortBy.key
  //   pagination.descending = sortBy.order === 'desc' ? true : false
  // }

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
  }
}
