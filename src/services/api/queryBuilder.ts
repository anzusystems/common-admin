import { ref } from 'vue'
import { isArray, isBoolean, isNull, isNumber, isString, isUndefined } from '@/utils/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'

/**
 * Docs: /doc/Admin-Cms-Doc/Filters.md
 */
export function useQueryBuilder() {
  const q = ref<string[]>([])

  const querySetLimit = (value: number): void => {
    queryAdd('limit', value)
  }

  const querySetOffset = (page: number, limit: number): void => {
    queryAdd('offset', page * limit - limit)
  }

  const querySetOrder = (field: string | null, desc: boolean): void => {
    if (!isNull(field)) queryAdd('order[' + field + ']', desc ? 'desc' : 'asc')
  }

  const formatValue = (value: string | number | boolean): string | number => {
    if (isBoolean(value)) {
      return value ? '1' : '0'
    }
    return value
  }

  const queryAddFilter = (filterVariant: FilterVariant, field: string, value: string | number | boolean): void => {
    if (isString(value) && value.length === 0) return
    q.value.push('filter_' + filterVariant + '[' + field + ']=' + formatValue(value))
  }

  const getValue = (filter: Filter): string | number | boolean | null => {
    const model = filter.model
    if (isNull(model)) {
      if (filter.mandatory) {
        filter.model = filter.default
        return filter.default
      }
      return null
    }
    if (isString(model)) {
      if (model.length === 0) {
        if (filter.mandatory) {
          filter.model = filter.default
          return filter.default
        }
        return null
      }
      return encodeURIComponent(model)
    }
    if (isArray(model)) {
      if (model.length === 0) {
        if (filter.mandatory) {
          filter.model = filter.default
          return filter.default
        }
        return null
      }
      return model.map((item) => (isString(item) ? encodeURIComponent(item) : item)).join(',')
    }
    if (isNumber(model) || isBoolean(model)) {
      return model
    }

    return null
  }

  const queryAdd = (key: string, value: any): void => {
    q.value.push(key + '=' + value)
  }

  const queryBuild = (): string => {
    return '?' + q.value.join('&')
  }

  const querySetFilters = (filterBag: FilterBag): void => {
    const isSearchApi = !isUndefined(filterBag._elastic)
    for (const filterName in filterBag) {
      const filter = filterBag[filterName]
      const field = filter.field || filterName
      if (filter.exclude) {
        continue
      }
      const value = getValue(filter)
      if (isNull(value)) {
        continue
      }
      if (isSearchApi) {
        queryAdd(field, value)
        continue
      }
      queryAddFilter(filter.variant, field, value)
    }
  }

  return {
    querySetLimit,
    querySetOffset,
    querySetOrder,
    queryAddFilter,
    querySetFilters,
    queryAdd,
    queryBuild,
  }
}
