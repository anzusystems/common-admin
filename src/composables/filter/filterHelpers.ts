import { cloneDeep, isArray, isEmptyArray, isEmptyObject, isNull, isObject, isUndefined } from '@/utils/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'

export interface MakeFilterOptions<T = any> {
  name: string
  variant: FilterVariant
  titleT?: string
  default: T | null
  field: string
  multiple: boolean
  clearable: boolean
  mandatory: boolean
  exclude: boolean
}

export function makeFilterHelper<T = any>(system?: string, subject?: string) {
  return (options: Partial<MakeFilterOptions<T>> = {}): Filter<T> => {
    const variant = isUndefined(options.variant) ? 'eq' : options.variant

    let defaultValue = isUndefined(options.default) ? null : options.default
    if (isUndefined(options.default) && variant === 'in') {
      defaultValue = [] as any
    }
    let titleT = options.titleT
    if (isUndefined(titleT) && system && subject && options.name) {
      titleT = system + '.' + subject + '.filter.' + options.name
    }

    return {
      variant,
      titleT,
      default: defaultValue,
      field: isUndefined(options.field) ? '' : options.field,
      multiple: isArray(defaultValue),
      clearable: isUndefined(options.clearable) ? true : options.clearable,
      mandatory: isUndefined(options.mandatory) ? false : options.mandatory,
      exclude: isUndefined(options.exclude) ? false : options.exclude,
      model: cloneDeep(defaultValue),
      error: '',
    }
  }
}

export function useFilterHelpers(storeId: string | undefined = undefined) {
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
    if (!storeId || !localStorage) return
    const stored = localStorage.getItem(storeId)
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
    if (!storeId || !localStorage) return
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
    localStorage.setItem(storeId, JSON.stringify(data))
  }

  const resetFilter = (filterBag: FilterBag, pagination: Pagination, callback?: any) => {
    clearAll(filterBag)
    pagination.page = 1
    if (storeId && localStorage) {
      localStorage.removeItem(storeId)
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
