import { ref } from 'vue'
import { isArray, isBoolean, isNull, isNumber, isString, isUndefined } from '@/utils/common'
import type { FilterVariant } from '@/types/Filter'
import type { AllowedFilterValues, FilterConfig, FilterData, FilterField } from '@/labs/filters/filterFactory'
import type { DatetimeUTCNullable } from '@/types/common'
import { TimeIntervalSpecialOptions, type TimeIntervalToolsValue } from '@/labs/filters/filterTimeIntervalTools'
import { dateModifyMinutes, dateTimeNow, dateTimeToDate, dateToUtc, getMonthInterval } from '@/utils/datetime'
import { SortOrder } from '@/composables/system/datatableColumns'

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
    if (!isNull(field) && field.length > 0) queryAdd('order[' + field + ']', desc ? SortOrder.Desc : SortOrder.Asc)
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

  const resolveTimeIntervalFilter = (
    fromName: string,
    untilName: string,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    mandatory: boolean,
    exclude: boolean
  ): null | {
    from: DatetimeUTCNullable
    until: DatetimeUTCNullable
  } => {
    let fromValue = filterData[fromName] as TimeIntervalToolsValue
    let untilValue = filterData[untilName] as DatetimeUTCNullable
    if (isNull(fromValue) && mandatory && !exclude) {
      fromValue = filterConfig.fields[fromName].default as TimeIntervalToolsValue
    }
    if (isNull(untilValue) && mandatory && !exclude) {
      untilValue = filterConfig.fields[fromName].default as DatetimeUTCNullable
    }
    if (isString(fromValue) && isString(untilValue)) {
      return {
        from: fromValue,
        until: untilValue,
      }
    }
    const now = dateTimeNow()
    const nowDate = dateTimeToDate(now)
    switch (fromValue) {
      case TimeIntervalSpecialOptions.CurrentMonth: {
        return getMonthInterval(nowDate, 'utc', 0, false)
      }
      case TimeIntervalSpecialOptions.LastMonth: {
        return getMonthInterval(nowDate, 'utc', -1, false)
      }
      case TimeIntervalSpecialOptions.Last3Months: {
        return getMonthInterval(nowDate, 'utc', -2, true)
      }
      default: {
        if (isNumber(fromValue)) {
          return {
            from: dateToUtc(dateModifyMinutes(fromValue * -1, nowDate)),
            until: now,
          }
        }
      }
    }
    return null
  }

  const getValue = (
    value: AllowedFilterValues,
    config: FilterField
  ): string | number | boolean | null => {
    if (isNull(value)) {
      if (config.mandatory && !config.exclude && !isUndefined(config.default)) {
        return isArray(config.default) ? config.default.join(',') : config.default
      }
      return null
    }
    if (isString(value)) {
      if (value.length === 0) {
        if (config.mandatory && !config.exclude && !isUndefined(config.default) && !isNull(config.default)) {
          return encodeURIComponent(isArray(config.default) ? config.default.join(',') : config.default)
        }
        return null
      }
      return encodeURIComponent(value)
    }
    if (isArray(value)) {
      if (value.length === 0) {
        if (config.mandatory && !config.exclude && isArray(config.default)) {
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
      const name = filterFieldConfig.apiName || filterName
      if (filterFieldConfig.type === 'timeInterval' && !isUndefined(filterFieldConfig.related)) {
        const data = resolveTimeIntervalFilter(
          filterName,
          filterFieldConfig.related,
          filterData,
          filterConfig,
          filterFieldConfig.mandatory,
          filterFieldConfig.exclude
        )
        if (isNull(data)) {
          continue
        }
        const filterFieldConfigRelated = filterConfig.fields[filterFieldConfig.related]
        const nameRelated = filterFieldConfigRelated.apiName || filterFieldConfig.related
        if (isSearchApi) {
          queryAdd(name, data.from)
          queryAdd(nameRelated, data.until)
          continue
        }
        if (data.from) queryAddFilter('gte', name, data.from)
        if (data.until) {
          queryAddFilter('lte', nameRelated, data.until)
        }
        continue
      }
      const value = getValue(filterFieldValue, filterFieldConfig)
      if (isNull(value)) {
        continue
      }
      if (isSearchApi) {
        queryAdd(name, value)
        continue
      }
      queryAddFilter(filterFieldConfig.variant, name, value)
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
    q,
  }
}
