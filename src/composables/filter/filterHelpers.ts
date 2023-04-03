import { cloneDeep, isArray, isUndefined } from '@/utils/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'

export interface MakeFilterOptions<T = any> {
  name: string
  variant: FilterVariant
  titleT?: string
  default: T | null
  field: string
  multiple: boolean
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
      mandatory: isUndefined(options.mandatory) ? false : options.mandatory,
      exclude: isUndefined(options.exclude) ? false : options.exclude,
      model: cloneDeep(defaultValue),
      error: '',
    }
  }
}

export function useFilterHelpers() {
  const clearOne = (filter: Filter) => {
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

  const resetFilter = (filterBag: FilterBag, pagination: Pagination, callback?: any) => {
    clearAll(filterBag)
    pagination.page = 1
    if (callback) callback()
  }

  const submitFilter = (filterBag: FilterBag, pagination: Pagination, callback: () => any) => {
    clearAllErrors(filterBag)
    pagination.page = 1
    callback()
  }

  return {
    clearAllErrors,
    clearAll,
    clearOne,
    resetFilter,
    submitFilter,
  }
}
