import { reactive } from 'vue'
import { cloneDeep, isArray, isUndefined } from '@/utils/common.ts'

const defaultRenderOptions: FilerRenderOptions = {
  skip: false,
  xs: 12,
  sm: 6,
  md: 4,
  lg: 3,
  xl: 2,
}

/**
 * Creates a filter configuration and reactive data store for managing filters.
 *
 * @param filterFields - Definitions for the available filters.
 * @param store - Reactive object holding the current state of the filter data.
 * @param options - Optional global options for the filter configuration.
 * @returns An object containing the filter configuration and reactive data store.
 */
export function createFilter<F extends readonly MakeFilterOption<any>[]>(
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
      const defaultValue = cloneDeep(store[key] as AllowedFilterData)

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
    {} as FilterConfig<typeof filterFields>['fields']
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

/**
 * Resolves a value, falling back to a default if the value is undefined.
 */
function resolveValue<T>(value: T | undefined, fallback: T): T {
  return isUndefined(value) ? fallback : value
}

/**
 * Provides utility functions for managing filter data.
 */
export function useFilterHelpers() {
  const clearOne = (name: string, filterData: FilterData<any>, filterConfig: FilterConfig<any>) => {
    if (!filterConfig.fields[name]?.clearable) return
    filterData[name] = cloneDeep(filterConfig.fields[name].default)
  }

  const clearAll = (filterData: FilterData<any>, filterConfig: FilterConfig<any>) => {
    for (const filterName in filterConfig.fields) {
      clearOne(filterName, filterData, filterConfig)
    }
  }

  const resetFilter = (filterData: FilterData<any>, filterConfig: FilterConfig<any>) => {
    clearAll(filterData, filterConfig)
  }

  const iterateFilterDataKeys = (filterData: Record<string, AllowedFilterData>) => {
    Object.keys(filterData).forEach((key: string) => {
      console.log(`Key: ${key}, Value: ${filterData[key]}`)
    })
  }

  return {
    clearOne,
    clearAll,
    resetFilter,
    iterateFilterDataKeys,
  }
}

export type AllowedFilterData = number | number[] | string | string[] | null | undefined | boolean

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

export type FilterType = 'boolean' | 'datetime' | 'integer' | 'string' | 'valueObject' | 'custom'

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
  default: AllowedFilterData
  field: string
  clearable: boolean
  mandatory: boolean
  multiple: boolean
  advanced: boolean
  exclude: boolean
  render: FilerRenderOptions
}

export type FilterConfig<F extends readonly MakeFilterOption<any>[] = readonly MakeFilterOption<any>[]> = {
  general: GeneralFilterOptions
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

export type FilterData<F extends readonly MakeFilterOption<any>[] = readonly MakeFilterOption<any>[]> = {
  [P in F[number]['name']]: AllowedFilterData
}

export type FilterStore<T extends readonly { name: string }[]> = {
  [K in T[number]['name']]: AllowedFilterData
}
