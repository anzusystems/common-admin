import { computed, ref, type Ref } from 'vue'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import { cloneDeep, isArray, isEmptyArray, isEmptyObject, isNull, isObject, isUndefined } from '@/utils/common'
import type { Pagination } from '@/types/Pagination'

export interface DefineFilterOptions {
  system: string
  subject: string
  search: boolean
}

export interface DefineFilterField {
  name: string
  field?: string
  variant?: FilterVariant
  titleT?: string
  default?: any
  multiple?: boolean
  clearable?: boolean
  mandatory?: boolean
  advanced?: boolean
  exclude?: boolean
}

const defineDefaultOptions = {
  system: undefined,
  subject: undefined,
  search: false,
}

export function defineFilter(
  model: Ref<any>,
  fields: Array<DefineFilterField>,
  options: Partial<DefineFilterOptions> = {}
) {
  const mergedOptions = { ...defineDefaultOptions, ...options }
  const localModel: any = {}

  function makeFilter(fieldOption: DefineFilterField) {
    const variant = isUndefined(fieldOption.variant) ? 'eq' : fieldOption.variant
    let defaultValue = isUndefined(fieldOption.default) ? null : fieldOption.default
    if (isUndefined(fieldOption.default) && variant === 'in') {
      defaultValue = [] as any
    }
    let titleT = fieldOption.titleT
    if (isUndefined(titleT) && mergedOptions.system && mergedOptions.subject && fieldOption.name) {
      titleT = mergedOptions.system + '.' + mergedOptions.subject + '.filter.' + fieldOption.name
    }

    localModel[fieldOption.name] = cloneDeep(defaultValue)

    return {
      variant,
      titleT,
      default: defaultValue,
      field: isUndefined(fieldOption.field) ? '' : fieldOption.field,
      multiple: isArray(defaultValue),
      clearable: isUndefined(fieldOption.clearable) ? true : fieldOption.clearable,
      mandatory: isUndefined(fieldOption.mandatory) ? false : fieldOption.mandatory,
      exclude: isUndefined(fieldOption.exclude) ? false : fieldOption.exclude,
      advanced: isUndefined(fieldOption.advanced) ? false : fieldOption.advanced,
      error: '',
      touched: false,
    }
  }

  const filterConfig: any = {}

  fields.forEach((field) => {
    filterConfig[field.name] = makeFilter(field)
  })
  const finalFilterConfig = ref(cloneDeep(filterConfig))
  model.value = cloneDeep(localModel)

  const advancedTouched = computed(() => {
    const count = 0
    for (const [key, value] of Object.entries(model.value)) {
      // if ()
    }
  })

  return {
    filterConfig: finalFilterConfig,
    advancedTouched,
  }
}

export interface FilterActionsOptions {
  storeId: string
}

const helpersDefaultOptions = {
  storeId: undefined,
}

export function useFilterHelpers(options: Partial<FilterActionsOptions> = {}) {
  const mergedOptions = { ...helpersDefaultOptions, ...options }

  const clearOne = (filter: Filter) => {
    if (!filter.clearable) return
    filter.model = filter.default
    filter.error = ''
  }

  const clearAll = (filterBag: FilterBag) => {
    for (const filterName in filterBag) {
      clearOne(filterBag[filterName])
    }
  }

  const clearAllErrors = (filterBag: FilterBag) => {
    for (const filterName in filterBag) {
      filterBag[filterName].error = ''
    }
  }

  const loadStoredFilter = (filterBag: FilterBag, callback?: any) => {
    if (!mergedOptions.storeId || !localStorage) return
    const stored = localStorage.getItem(mergedOptions.storeId)
    if (!stored) return
    const storedData = JSON.parse(stored)
    if (!isObject(storedData)) return
    for (const filterName in filterBag) {
      try {
        // @ts-ignore
        if (!isUndefined(storedData[filterName])) {
          // @ts-ignore
          filterBag[filterName].model = storedData[filterName]
        }
      } catch (e) {
        //
      }
    }
    if (callback) callback()
  }

  const storeFilter = (filterBag: FilterBag) => {
    if (!mergedOptions.storeId || !localStorage) return
    const data: Record<string, any> = {}
    for (const filterName in filterBag) {
      try {
        if (
          !filterName.startsWith('_') &&
          !isUndefined(filterBag[filterName].model) &&
          !isNull(filterBag[filterName].model) &&
          !isEmptyObject(filterBag[filterName].model) &&
          !isEmptyArray(filterBag[filterName].model)
        ) {
          data[filterName] = filterBag[filterName].model
        }
      } catch (e) {
        //
      }
    }
    if (isEmptyObject(data)) return
    localStorage.setItem(mergedOptions.storeId, JSON.stringify(data))
  }

  const resetFilter = (filterBag: FilterBag, pagination: Pagination, callback?: any) => {
    clearAll(filterBag)
    pagination.page = 1
    if (mergedOptions.storeId && localStorage) {
      localStorage.removeItem(mergedOptions.storeId)
    }
    if (callback) callback()
  }

  const submitFilter = (filterBag: FilterBag, pagination: Pagination, callback: () => any) => {
    clearAllErrors(filterBag)
    storeFilter(filterBag)
    pagination.page = 1
    callback()
  }

  return {
    clearAllErrors,
    clearAll,
    clearOne,
    resetFilter,
    submitFilter,
    loadStoredFilter,
  }
}
