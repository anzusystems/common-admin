import { reactive, type Ref } from 'vue'
import {
  cloneDeep,
  isArray,
  isEmptyArray,
  isEmptyObject,
  isNull,
  isObject,
  isString,
  isUndefined,
} from '@/utils/common'
import type { AnyFn } from '@vueuse/core'
import type { Pagination } from '@/labs/filters/pagination'
import { type DatatableSortBy, SortOrder } from '@/composables/system/datatableColumns'

const SORT_URL_PARAM = '_sort'

const defaultRenderOptions: FilerRenderOptions = {
  skip: false,
  xs: 12,
  sm: 6,
  md: 4,
  lg: 3,
  xl: 2,
}

export function createFilterStore<F extends readonly MakeFilterOption<string>[]>(
  filterFields: F
): FilterData<F> {
  return reactive(
    filterFields.reduce((acc, field) => {
      return {
        ...acc,
        [field.name]: cloneDeep(field.default)
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

      console.log(key, defaultValue)

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
    ...options,
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
    console.log(name, filterConfig.fields[name].default)
    filterData[name] = cloneDeep(filterConfig.fields[name].default)
  }

  const clearAll = (filterData: FilterData<F>, filterConfig: FilterConfig<F>) => {
    for (const filterName in filterConfig.fields) {
      clearOne(filterName as keyof FilterData<F>, filterData, filterConfig)
    }
  }

  return {
    clearOne,
    clearAll,
    // resetFilter,
  }
}

export function useFilterHelpers<F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[]>(
  filterData: FilterData<F>,
  filterConfig: FilterConfig<F>,
  systemResource: string | undefined = undefined
) {
  const END_FILTER_MARKER = '~'

  const storeKey = systemResource ? 'datatableFilter_' + systemResource : undefined

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
    window.location.hash = serialized
  }

  const parseLocationHash = () => {
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
    window.location.hash = ''
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
      const value = storedFromHash.filters[key]
      if (isUndefined(value)) continue
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
}

export interface FilerRenderOptions {
  skip: boolean
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
}

export type FilterVariant =
  | 'search'
  | 'lt'
  | 'in'
  | 'notIn'
  | 'endsWith'
  | 'startsWith'
  | 'memberOf'
  | 'contains'
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
