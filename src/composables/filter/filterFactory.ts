import { type Reactive, reactive, type Ref } from 'vue'
import {
  cloneDeep,
  isArray,
  isEmptyArray,
  isEmptyObject,
  isNull,
  isObject,
  isString,
  isUndefined
} from '@/utils/common'
import type { Pagination } from '@/types/Pagination.ts'
import type { AnyFn } from '@vueuse/core'
import type { FilterBag } from '@/types/Filter.ts'

const defaultRenderOptions: FilerRenderOptions = {
  skip: false,
  xs: 12,
  sm: 6,
  md: 4,
  lg: 3,
  xl: 2,
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
      const defaultValue = cloneDeep(store[key] as AllowedFilterValues)

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
          field: resolveValue(filter.field, ''),
          clearable: resolveValue(filter.clearable, true),
          mandatory: resolveValue(filter.mandatory, false),
          multiple: isArray(defaultValue),
          advanced: resolveValue(filter.advanced, false),
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

  return {
    clearOne,
    clearAll,
    // resetFilter,
  }
}

export function useFilterHelpers<F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[]>(
  filterData: FilterData<F>,
  filterConfig: FilterConfig<F>,
  pagination: Reactive<Pagination>,
  datatableColumnsHidden: Ref<string[]>,
  storeId: string | undefined = undefined
) {
  const getFilterDataForStoring = () => {
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
        //
      }
    }

    return data
  }

  const END_FILTER_MARKER = '~'

  const serializeFilters = (data: Record<string, AllowedFilterValues>): string => {
    const params = new URLSearchParams(data as Record<string, string>)
    if (params.size === 0) return ''
    return params.toString() + END_FILTER_MARKER
  }

  const deserializeFilters = (hash: string): Record<string, AllowedFilterValues> => {
    if (!hash) return {}
    if (hash.startsWith('#')) hash = hash.substring(1)
    if (!hash.endsWith(END_FILTER_MARKER)) {
      const lastAmpersand = hash.lastIndexOf('&')
      if (lastAmpersand !== -1) {
        hash = hash.substring(0, lastAmpersand)
      } else {
        return {}
      }
    } else {
      hash = hash.slice(0, -1)
    }
    return Object.fromEntries(new URLSearchParams(hash))
  }

  const updateLocationHash = (serialized: string) => {
    window.location.hash = serialized
  }

  const parseLocationHash = (): Record<string, AllowedFilterValues> => {
    return deserializeFilters(window.location.hash)
  }

  const storeFilterLocalStorage = (serialized: string) => {
    if (!storeId || !localStorage) return
    localStorage.setItem(storeId, serialized)
  }

  const loadFilterLocalStorage = () => {
    if (!storeId || !localStorage) return {}
    const stored = localStorage.getItem(storeId)
    if (!stored || !isString(stored)) return {}
    return deserializeFilters(stored)
  }

  const resetFilter = (callback?: AnyFn) => {
    pagination.page = 1
    if (storeId && localStorage) {
      localStorage.removeItem(storeId)
    }
    window.location.hash = ''
    if (callback) callback()
  }

  const submitFilter = (callback?: AnyFn) => {
    const data = getFilterDataForStoring()
    const serialized = serializeFilters(data)
    updateLocationHash(serialized)
    storeFilterLocalStorage(serialized)
    pagination.page = 1
    if (callback) callback()
  }

  const loadStoredFilters = () => {
    let stored = parseLocationHash()
    if (isEmptyObject(stored)) {
      stored = loadFilterLocalStorage()
    }
    if (isEmptyObject(stored)) return false
    for (const filterName in filterData) {
      const key = filterName as keyof FilterData<F>
      const value = stored[key]
      if (isUndefined(value)) continue
      filterData[key] = value
    }
    return true
  }

  return {
    loadStoredFilters,
    resetFilter,
    submitFilter,
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
  type?: FilterType
  variant?: FilterVariant
  titleT?: string
  field?: string
  clearable?: boolean
  mandatory?: boolean
  advanced?: boolean
  exclude?: boolean
  render?: Partial<FilerRenderOptions>
}

export interface FilterField {
  name: string
  type: FilterType
  variant: FilterVariant
  titleT?: string
  default: AllowedFilterValues
  field: string
  clearable: boolean
  mandatory: boolean
  multiple: boolean
  advanced: boolean
  exclude: boolean
  render: FilerRenderOptions
}

export type FilterConfig<F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[]> = {
  general: GeneralFilterOptions
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
