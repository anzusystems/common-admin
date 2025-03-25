import { ref } from 'vue'
import { isArray, isBoolean, isNull, isNumber, isString, isUndefined } from '@/utils/common'
import type { FilterVariant } from '@/types/Filter'
import type { AllowedFilterValues, FilterConfig, FilterData, FilterField } from '@/composables/filter/filterFactory'

/**
 * Docs: /doc/Admin-Cms-Doc/Filters.md
 */
export function useApiQueryBuilder() {
  const q = ref<string[]>([])

  const querySetLimit = (value: number): void => {
    queryAdd('limit', value)
  }

  const querySetOffset = (page: number, limit: number): void => {
    queryAdd('offset', page * limit - limit)
  }

  const querySetOrder = (field: string | null, desc: boolean): void => {
    if (!isNull(field) && field.length > 0) queryAdd('order[' + field + ']', desc ? 'desc' : 'asc')
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

  const getValue = (
    value: AllowedFilterValues,
    config: FilterField
  ): string | number | boolean | null => {
    if (isNull(value)) {
      if (config.mandatory && !isUndefined(config.default)) {
        return isArray(config.default) ? config.default.join(',') : config.default
      }
      return null
    }
    if (isString(value)) {
      if (value.length === 0) {
        if (config.mandatory && !isUndefined(config.default) && !isNull(config.default)) {
          return encodeURIComponent(isArray(config.default) ? config.default.join(',') : config.default)
        }
        return null
      }
      return encodeURIComponent(value)
    }
    if (isArray(value)) {
      if (value.length === 0) {
        if (config.mandatory && isArray(config.default)) {
          return config.default.map((item) => (isString(item) ? encodeURIComponent(item) : item)).join(',')
        }
        return null
      }
      return value.map((item) => (isString(item) ? encodeURIComponent(item) : item)).join(',')
    }
    if (isNumber(value) || isBoolean(value)) {
      return value
    }

    return null
  }

  const queryAdd = (key: string, value: any): void => {
    q.value.push(key + '=' + value)
  }

  const queryBuild = (): string => {
    return '?' + q.value.join('&')
  }

  const querySetFilters = (filterData: FilterData<any>, filterConfig: FilterConfig<any>): void => {
    const isSearchApi = filterConfig.general.elastic
    for (const filterName in filterData) {
      const filterFieldValue = filterData[filterName] as AllowedFilterValues
      const filterFieldConfig = filterConfig.fields[filterName]
      if (isUndefined(filterFieldConfig) || filterFieldConfig.exclude) {
        continue
      }
      const value = getValue(filterFieldValue, filterFieldConfig)
      if (isNull(value)) {
        continue
      }
      if (isSearchApi) {
        queryAdd(filterName, value)
        continue
      }
      queryAddFilter(filterFieldConfig.variant, filterName, value)
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
