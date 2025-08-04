import {
  type ColumnConfig,
  type ColumnInternalValues,
  DATETIME_AUTO_LABEL_TRACKING,
  type StoredData,
} from '@/composables/system/datatableColumns'
import { computed, onMounted, type Ref, watch } from 'vue'
import { i18n } from '@/plugins/i18n'
import { isArray, isBoolean, isObject, isString, isUndefined } from '@/utils/common'

const defaultColumn: ColumnInternalValues = {
  key: '',
  title: undefined,
  sortable: false,
  fixed: false,
}

interface DatatableColumnsConfigMoreOptions {
  store: string | boolean // false to disable, string to override store key
  disableActions: boolean
  customI18n: any
  showExpand: boolean
}

const DatatableColumnsConfigMoreOptionsDefault = {
  store: true,
  disableActions: false,
  customI18n: undefined,
  showExpand: false,
}

export function createDatatableColumnsConfig(
  config: ColumnConfig[],
  columnsHidden: Ref<Array<string>>,
  system: string,
  subject: string,
  moreOptions: Partial<DatatableColumnsConfigMoreOptions> = {}
) {
  const options = { ...DatatableColumnsConfigMoreOptionsDefault, ...moreOptions }
  const localI18n = options.customI18n ?? i18n
  const { t } = localI18n.global || localI18n

  let storeKey: undefined | string = undefined
  if (isString(options.store)) {
    storeKey = options.store
  } else if (isBoolean(options.store) && true === options.store) {
    storeKey = 'table_' + system + '_' + subject
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
    if (options.showExpand) columns.push({ key: 'data-table-expand', sortable: false })
    columnsAll.forEach((column) => {
      if (!columnsHidden.value.includes(column.key)) {
        columns.push(column)
      }
    })
    if (!options.disableActions) columns.push({ key: 'actions', sortable: false, fixed: 'end' })
    return columns
  })

  const loadStoredColumns = () => {
    if (!storeKey || !localStorage) return
    const stored = localStorage.getItem(storeKey)
    if (!stored) return
    const storedData = JSON.parse(stored) as StoredData
    if (!isObject(storedData)) return
    if (!isArray(storedData.hidden)) return
    columnsHidden.value = storedData.hidden as string[]
  }

  const storeColumns = (columns: string[]) => {
    if (!storeKey || !localStorage) return
    localStorage.setItem(storeKey, JSON.stringify({ hidden: columns }))
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
