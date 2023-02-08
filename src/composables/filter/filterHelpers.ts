import { isArray, isUndefined } from '@/utils/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import { simpleCloneObject } from '@/utils/object'
import { useI18n } from '@/createCommonAdmin'

const { t } = useI18n()

export interface MakeFilterOptions<T = any> {
  name: string
  variant: FilterVariant
  title: string
  translationSuffix: undefined
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

    let title = isUndefined(options.title) ? '' : options.title
    if (title === '' && system && subject && options.name) {
      title = t(system + '.' + subject + '.filter.' + options.name)
    }

    return {
      variant,
      title,
      default: defaultValue,
      field: isUndefined(options.field) ? '' : options.field,
      multiple: isArray(defaultValue),
      mandatory: isUndefined(options.mandatory) ? false : options.mandatory,
      exclude: isUndefined(options.exclude) ? false : options.exclude,
      model: simpleCloneObject(defaultValue),
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
