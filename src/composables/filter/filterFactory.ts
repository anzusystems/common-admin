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

export function createFilter<F extends readonly MakeFilterOption<any>[]>(
  filterFields: F,
  store: FilterData<F>,
  options?: Partial<GeneralFilterOptions>
): {
  filterConfig: FilterConfig<F>
  filterData: FilterData<F>
} {
  type ConfigMap = {
    [P in F[number]['name']]: FilterField
  }

  const config = filterFields.reduce((acc, filter) => {
    const key = filter.name as keyof FilterData<F>
    const defaultValue = cloneDeep(store[key] as AllowedFilterData)
    const type: FilterType = isUndefined(filter.type) ? 'custom' : filter.type
    const variant: FilterVariant = isUndefined(filter.variant) ? 'eq' : filter.variant
    let titleT = filter.titleT
    if (isUndefined(titleT) && options?.system && options?.subject && filter.name) {
      titleT = `${options.system}.${options.subject}.filter.${filter.name}`
    }
    return {
      ...acc,
      [key]: {
        name: key as string,
        variant,
        type,
        titleT,
        field: isUndefined(filter.field) ? '' : filter.field,
        clearable: isUndefined(filter.clearable) ? true : filter.clearable,
        mandatory: isUndefined(filter.mandatory) ? false : filter.mandatory,
        multiple: isArray(defaultValue),
        advanced: isUndefined(filter.advanced) ? false : filter.advanced,
        exclude: isUndefined(filter.exclude) ? false : filter.exclude,
        default: defaultValue,
        render: isUndefined(filter.render)
          ? { ...defaultRenderOptions }
          : { ...defaultRenderOptions, ...filter.render },
      },
    }
  }, {} as ConfigMap)

  const defaultGlobalOptions: GeneralFilterOptions = {
    elastic: false,
    system: undefined,
    subject: undefined,
    ...options,
  }

  const filterConfig = reactive({
    general: defaultGlobalOptions,
    fields: reactive(config),
  }) as FilterConfig<F>

  return {
    filterConfig,
    filterData: store as FilterData<F>,
  }
}

export function useFilterHelpers() {
  const clearOne = (
    name: string,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    if (!filterConfig.fields[name]?.clearable) return
    filterData[name] = cloneDeep(filterConfig.fields[name].default)
  }

  const clearAll = (
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    for (const filterName in filterConfig.fields) {
      clearOne(filterName, filterData, filterConfig)
    }
  }

  const resetFilter = (
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    clearAll(filterData, filterConfig)
    // Additional reset logic (pagination, callbacks, etc.) can be added here.
  }

  const iterateFilterDataKeys = (filterData: Record<string, AllowedFilterData>) => {
    Object.keys(filterData).forEach((key: string) => {
      const value = filterData[key]
      console.log(`Key: ${key}, Value: ${value}`)
    })
  }

  return {
    clearOne,
    clearAll,
    resetFilter,
    iterateFilterDataKeys,
  }
}

/** Allowed filter data types */
export type AllowedFilterData =
  | number
  | number[]
  | string
  | string[]
  | null
  | undefined
  | boolean

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

export type FilterType =
  | 'boolean'
  | 'datetime'
  | 'integer'
  | 'string'
  | 'valueObject'
  | 'custom'

/** A filter make definition. */
export interface MakeFilterOption<TName extends string> {
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

/** Representation of a filter field in the configuration object. */
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

/** FilterConfig uses the literal names from filter definitions as keys. */
export type FilterConfig<F extends readonly MakeFilterOption<any>[]> = {
  general: GeneralFilterOptions
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

/** FilterData is a mapping of filter names to default values. */
export type FilterData<F extends readonly MakeFilterOption<any>[]> = {
  [P in F[number]['name']]: AllowedFilterData
}

/** FilterStore for external usage (if needed). */
export type FilterStore<T extends readonly { name: string }[]> = {
  [K in T[number]['name']]: AllowedFilterData
}
