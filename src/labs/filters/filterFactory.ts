import { reactive, type Ref, toRaw } from 'vue'
import {
  cloneDeep,
  isArray,
  isBoolean,
  isEmptyArray,
  isEmptyObject,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from '@/utils/common'
import type { AnyFn } from '@vueuse/core'
import type { Pagination } from '@/labs/filters/pagination'
import { type DatatableSortBy, SortOrder } from '@/composables/system/datatableColumns'
import { stringToBooleanExact, stringToNumber } from '@/utils/string'
import type { ValueObjectOption } from '@/types/ValueObject'

export type FilterStoreIdentifier = { system: string; subject: string }

const SORT_URL_PARAM = '_sort'

const defaultRenderOptions: FilerRenderOptions = {
  skip: false,
  xs: undefined,
  sm: undefined,
  md: undefined,
  lg: undefined,
  xl: undefined,
}

export function createFilterStore<F extends readonly MakeFilterOption<string>[]>(filterFields: F): FilterData<F> {
  return reactive(
    filterFields.reduce((acc, field) => {
      return {
        ...acc,
        [field.name]: cloneDeep(field.default),
      }
    }, {} as FilterData<F>)
  ) as FilterData<F>
}

export function createFilter<F extends readonly MakeFilterOption<string>[]>(
  filterFields: F,
  store: FilterData<F>,
  options?: Partial<GeneralFilterOptions>
): {
  filterConfig: FilterConfig<F>
  filterData: FilterData<F>
} {
  const config = filterFields.reduce(
    (acc, filter) => {
      const key = filter.name as keyof FilterData<F>
      const defaultValue = cloneDeep(filter.default)

      return {
        ...acc,
        [key]: {
          name: key as string,
          variant: resolveValue(filter.variant, 'eq'),
          type: resolveValue(filter.type, 'custom'),
          titleT:
            filter.titleT ??
            (options?.system && options?.subject && filter.name
              ? `${options.system}.${options.subject}.filter.${filter.name}`
              : undefined),
          apiName: resolveValue(filter.apiName, filter.name),
          clearable: resolveValue(filter.clearable, true),
          mandatory: resolveValue(filter.mandatory, false),
          multiple: isArray(defaultValue),
          advanced: resolveValue(filter.advanced, false),
          related: resolveValue(filter.related, undefined),
          exclude: resolveValue(filter.exclude, false),
          default: defaultValue,
          render: { ...defaultRenderOptions, ...resolveValue(filter.render, {}) },
        },
      }
    },
    {} as FilterConfig<F>['fields']
  )

  const defaultGlobalOptions: GeneralFilterOptions = {
    elastic: false,
    system: undefined,
    subject: undefined,
    simpleFilters: false,
    ...options,
  }

  if (defaultGlobalOptions.elastic) {
    defaultGlobalOptions.simpleFilters = true
  }

  const filterConfig = reactive({
    general: defaultGlobalOptions,
    touched: false,
    fields: config,
  }) as FilterConfig<F>

  return {
    filterConfig,
    filterData: store as FilterData<F>,
  }
}

function resolveValue<T>(value: T | undefined, fallback: T): T {
  return isUndefined(value) ? fallback : value
}

export function useFilterClearHelpers<
  F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[],
>() {
  const clearOne = (name: keyof FilterData<F>, filterData: FilterData<F>, filterConfig: FilterConfig<F>) => {
    if (!filterConfig.fields[name]?.clearable) return
    filterData[name] = cloneDeep(filterConfig.fields[name].default)
  }

  const clearAll = (filterData: FilterData<F>, filterConfig: FilterConfig<F>) => {
    for (const filterName in filterConfig.fields) {
      clearOne(filterName as keyof FilterData<F>, filterData, filterConfig)
    }
  }
  const clearOneFilterSelected = (
    name: string,
    optionValue: number | string,
    filterData: FilterData<F>,
    filterConfig: FilterConfig<F>,
    filterSelected: Ref<Map<string, ValueObjectOption<string | number>[]>>
  ) => {
    if (!isClearable(name, filterConfig)) return
    // update selected
    const config = filterConfig.fields[name as keyof FilterConfig<F>['fields']]
    const selectedFound = filterSelected.value.get(name)
    if (selectedFound && selectedFound.length === 1) {
      filterSelected.value.delete(name)
    } else if (selectedFound) {
      const foundIndex = selectedFound.findIndex((item) => item.value === optionValue)
      selectedFound.splice(foundIndex, 1)
    }
    // update data
    if (config.type === 'timeInterval' && config.related) {
      filterData[name as keyof FilterData<F>] = config.default
      filterData[config.related as keyof FilterData<F>] =
        filterConfig.fields[config.related as keyof FilterConfig<F>['fields']].default
    } else if (
      isArray(filterData[name as keyof FilterData<F>]) &&
      (filterData[name as keyof FilterData<F>] as any[]).length > 0
    ) {
      const foundIndex = (filterData[name as keyof FilterData<F>] as any[]).findIndex((item) => item === optionValue)
      const newArray = [...toRaw(filterData[name as keyof FilterData<F>] as any[])]
      newArray.splice(foundIndex, 1)
      filterData[name as keyof FilterData<F>] = newArray as AllowedFilterValues
    } else if (isString(filterData[name as keyof FilterData<F>]) || isNumber(filterData[name as keyof FilterData<F>])) {
      filterData[name as keyof FilterData<F>] = config.default
    } else if (isBoolean(filterData[name as keyof FilterData<F>])) {
      filterData[name as keyof FilterData<F>] = config.default
    }
  }

  const clearAllFilterSelected = (
    filterData: FilterData<F>,
    filterConfig: FilterConfig<F>,
    filterSelected: Ref<Map<string, ValueObjectOption<string | number>[]>>
  ) => {
    for (const key of filterSelected.value.keys()) {
      if (isClearable(key, filterConfig)) {
        filterSelected.value.delete(key)
      }
    }
  }

  const isClearable = (name: string, filterConfig: FilterConfig<F>) => {
    const config = filterConfig.fields[name as keyof FilterConfig<F>['fields']]
    return !(config.mandatory || !config.clearable)
  }

  return {
    clearOne,
    clearAll,
    clearOneFilterSelected,
    clearAllFilterSelected,
    isClearable,
  }
}

interface FilterHelpersMoreOptions {
  storeFiltersLocalStorage: string | boolean // false to disable, string to override store key
  populateUrlParams: boolean
}

const FilterHelpersMoreOptionsDefault = {
  storeFiltersLocalStorage: true,
  populateUrlParams: true,
}

export function useFilterHelpers<F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[]>(
  filterData: FilterData<F>,
  filterConfig: FilterConfig<F>,
  moreOptions: Partial<FilterHelpersMoreOptions> = {}
) {
  const options = { ...FilterHelpersMoreOptionsDefault, ...moreOptions }
  const END_FILTER_MARKER = '~'

  let storeKey: undefined | string = undefined
  if (isString(options.storeFiltersLocalStorage)) {
    storeKey = options.storeFiltersLocalStorage
  } else if (
    isBoolean(options.storeFiltersLocalStorage) &&
    true === options.storeFiltersLocalStorage &&
    isString(filterConfig.general.system) &&
    isString(filterConfig.general.subject)
  ) {
    storeKey = 'tableFilter_' + filterConfig.general.system + '_' + filterConfig.general.subject
  }

  const getFilterDataForStoring = (): Record<string, AllowedFilterValues> => {
    const data: Record<string, AllowedFilterValues> = {}
    for (const filterName in filterData) {
      try {
        const key = filterName as keyof FilterData<F>
        const value = filterData[key]
        if (
          !isUndefined(value) &&
          !isNull(value) &&
          !isEmptyArray(value) &&
          value !== filterConfig.fields[key].default
        ) {
          data[filterName] = value
        }
      } catch (e) {
        // Ignore errors
      }
    }
    return data
  }

  const serializeFilters = (
    data: Record<string, AllowedFilterValues>,
    pagination: Ref<Pagination>,
    includeSort: boolean
  ): string => {
    const params = new URLSearchParams()
    for (const key in data) {
      const value = data[key]
      if (isUndefined(value) || isNull(value)) continue
      if (isArray(value) && isEmptyArray(value)) continue
      if (isObject(value) && isEmptyObject(value)) continue
      if (isString(value) && value.length === 0) continue
      if (isArray(value)) {
        params.set(key, value.join(','))
      } else {
        params.set(key, String(value))
      }
    }
    if (includeSort && pagination.value.sortBy) {
      params.set(SORT_URL_PARAM, `${pagination.value.sortBy.key},${pagination.value.sortBy.order}`)
    }
    if (params.size === 0) return ''
    return params.toString() + END_FILTER_MARKER
  }

  const deserializeFilters = (
    hash: string
  ): { filters: Record<string, AllowedFilterValues>; sortBy: DatatableSortBy } | null => {
    if (!hash) return null
    if (hash.startsWith('#')) hash = hash.substring(1)

    if (!hash.endsWith(END_FILTER_MARKER)) {
      const lastAmpersand = hash.lastIndexOf('&')
      if (lastAmpersand !== -1) {
        hash = hash.substring(0, lastAmpersand)
      } else {
        return null
      }
    } else {
      hash = hash.slice(0, -1)
    }

    const params = new URLSearchParams(hash)
    const result: Record<string, AllowedFilterValues> = {}
    let sortBy: DatatableSortBy = null

    const sortParam = params.get(SORT_URL_PARAM)
    if (sortParam) {
      const [key, order] = sortParam.split(',')
      if (key && (order === SortOrder.Asc || order === SortOrder.Desc)) {
        sortBy = { key, order }
      }
      params.delete(SORT_URL_PARAM)
    }

    for (const [key, value] of params.entries()) {
      const fieldConfig = filterConfig.fields[key as keyof typeof filterConfig.fields]
      if (isUndefined(fieldConfig)) {
        console.error(`Filter config not found for ${key}`)
        continue
      }
      const isMultiple = fieldConfig.multiple ?? false

      if (isMultiple) {
        const items = value.split(',')

        const allNumeric = items.every((item) => !isNaN(Number(item)))

        result[key] = allNumeric ? items.map(Number) : items
      } else {
        result[key] = value
      }
    }

    return { filters: result, sortBy }
  }

  const updateLocationHash = (serialized: string) => {
    if (options.populateUrlParams === false) return
    window.location.hash = serialized
  }

  const resetLocationHash = () => {
    if (options.populateUrlParams === false) return
    window.location.hash = ''
  }

  const parseLocationHash = () => {
    if (options.populateUrlParams === false) return null
    return deserializeFilters(window.location.hash)
  }

  const storeFilterLocalStorage = (serialized: string) => {
    if (!storeKey || !localStorage) return
    localStorage.setItem(storeKey, serialized)
  }

  const loadFilterLocalStorage = () => {
    if (!storeKey || !localStorage) return null
    const stored = localStorage.getItem(storeKey)
    if (!stored || !isString(stored)) return null
    return deserializeFilters(stored)
  }

  const resetFilter = (pagination: Ref<Pagination>, callback?: AnyFn) => {
    pagination.value = { ...pagination.value, page: 1 }
    if (storeKey && localStorage) {
      localStorage.removeItem(storeKey)
    }
    resetLocationHash()
    filterConfig.touched = false
    if (callback) callback()
  }

  const submitFilter = (pagination: Ref<Pagination>, callback?: AnyFn) => {
    const data = getFilterDataForStoring()
    const serialized = serializeFilters(data, pagination, true)
    updateLocationHash(serialized)
    storeFilterLocalStorage(serialized)
    pagination.value = { ...pagination.value, page: 1 }
    filterConfig.touched = false
    if (callback) callback()
  }

  const loadStoredFilters = (pagination: Ref<Pagination>, callback?: AnyFn) => {
    let source: 'hash' | 'localStorage' = 'hash'
    let storedFromHash = parseLocationHash()
    if (isNull(storedFromHash)) {
      source = 'localStorage'
      storedFromHash = loadFilterLocalStorage()
    }
    if (isNull(storedFromHash) || (isEmptyObject(storedFromHash.filters) && isEmptyObject(storedFromHash.sortBy))) {
      if (callback) callback()
      return false
    }

    for (const filterName in filterData) {
      const key = filterName as keyof FilterData<F>
      let value = storedFromHash.filters[key]
      if (isUndefined(value)) continue
      if (isString(value)) {
        const tryConvertNumber = stringToNumber(value)
        if (!isNull(tryConvertNumber)) {
          value = tryConvertNumber
        } else {
          // If not a number, try to convert to boolean
          const tryConvertBoolean = stringToBooleanExact(value)
          if (!isNull(tryConvertBoolean)) {
            value = tryConvertBoolean
          }
        }
      }
      filterData[key] = value
    }
    if (source === 'localStorage' && storeKey && localStorage) {
      const stored = localStorage.getItem(storeKey)
      if (stored) {
        updateLocationHash(stored)
      }
    }
    pagination.value = { ...pagination.value, sortBy: storedFromHash.sortBy }
    if (callback) callback()
    return true
  }

  return {
    loadStoredFilters,
    resetFilter,
    submitFilter,
    serializeFilters,
    deserializeFilters,
  }
}

export type AllowedFilterValues = number | number[] | string | string[] | null | undefined | boolean

export interface GeneralFilterOptions {
  system?: string
  subject?: string
  elastic?: boolean
  simpleFilters?: boolean
}

export interface FilerRenderOptions {
  skip: boolean
  xs: number | undefined
  sm: number | undefined
  md: number | undefined
  lg: number | undefined
  xl: number | undefined
}

export type FilterVariant =
  | 'search'
  | 'lt'
  | 'in'
  | 'notIn'
  | 'endsWith'
  | 'startsWith'
  | 'memberOf'
  | 'neq'
  | 'gte'
  | 'gt'
  | 'eq'
  | 'lte'
  | 'custom'

export type FilterType = 'boolean' | 'datetime' | 'integer' | 'string' | 'custom' | 'timeInterval'

export interface MakeFilterOption<TName extends string = string> {
  name: TName
  default: AllowedFilterValues
  type?: FilterType
  variant?: FilterVariant
  titleT?: string
  apiName?: string
  clearable?: boolean
  mandatory?: boolean
  advanced?: boolean
  exclude?: boolean
  related?: string | undefined
  render?: Partial<FilerRenderOptions>
}

export interface FilterField {
  name: string
  type: FilterType
  variant: FilterVariant
  titleT?: string
  default: AllowedFilterValues
  apiName: string
  clearable: boolean
  mandatory: boolean
  multiple: boolean
  advanced: boolean
  exclude: boolean
  related: string | undefined
  render: FilerRenderOptions
}

export type FilterConfig<F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[]> = {
  general: GeneralFilterOptions
  touched: boolean
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

export type FilterData<F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[]> = {
  [P in F[number]['name']]: AllowedFilterValues
}

export type FilterStore<T extends readonly { name: string }[]> = {
  [K in T[number]['name']]: AllowedFilterValues
}
