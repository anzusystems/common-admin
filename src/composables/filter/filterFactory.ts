import { reactive } from 'vue'
import { cloneDeep, isArray, isUndefined } from '@/utils/common.ts'
import type { ValueObjectOption } from '@/types/ValueObject.ts'

export type AllowedFilterData = number | number[] | string | string[] | null | undefined | boolean

export interface GeneralFilterOptions {
  elastic: boolean
  system: string | undefined
  subject: string | undefined
  globalStore: Record<string, AllowedFilterData> | undefined
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

export interface MakeFilterOption<
  TName extends string = string,
  TDefault extends AllowedFilterData = AllowedFilterData,
> {
  name: TName
  variant?: FilterVariant
  titleT?: string
  default: TDefault
  field?: string
  clearable?: boolean
  mandatory?: boolean
  advanced?: boolean
  exclude?: boolean
}

// export type MakeFilterOptions = MakeFilterOption<any, any>[]

export type FilterFieldStore<T extends string, V> = {
  name: T
  default: V
}

export interface FilterField<T extends AllowedFilterData = AllowedFilterData> {
  name: string
  variant: FilterVariant
  titleT?: string
  default: T
  field: string
  clearable: boolean
  selected: ValueObjectOption<string | number>[]
  mandatory: boolean
  multiple: boolean
  advanced: boolean
  exclude: boolean
}

export type FilterConfig<F extends readonly MakeFilterOption[]> = {
  _general: GeneralFilterOptions
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

export type FilterData<F extends readonly MakeFilterOption[]> = {
  [P in F[number]['name']]: F[number] extends { default: infer D } ? D : never
}

export type FilterStore<T extends readonly FilterFieldStore<string, any>[]> = {
  [K in T[number]['name']]: Extract<T[number], { name: K }>['default']
}

export function createFilter<F extends readonly MakeFilterOption<any, any>[]>(
  filters: F,
  generalOptions?: Partial<GeneralFilterOptions>
): {
  filterConfig: FilterConfig<F>
  filterData: FilterData<F>
} {
  type ConfigMap = {
    [P in F[number]['name']]: FilterField
  }
  type DataMap = {
    [key: string]: AllowedFilterData
  }

  const config = filters.reduce((acc, filter) => {
    const key = filter.name
    const variant: FilterVariant = isUndefined(filter.variant) ? 'eq' : filter.variant
    const defaultValue = (isUndefined(filter.default) ? null : filter.default) as AllowedFilterData
    let titleT = filter.titleT
    if (isUndefined(titleT) && generalOptions?.system && generalOptions?.subject && filter.name) {
      titleT = `${generalOptions.system}.${generalOptions.subject}.filter.${filter.name}`
    }
    return {
      ...acc,
      [key]: {
        name: key,
        variant,
        titleT,
        field: isUndefined(filter.field) ? '' : filter.field,
        clearable: isUndefined(filter.clearable) ? true : filter.clearable,
        selected: [],
        mandatory: isUndefined(filter.mandatory) ? false : filter.mandatory,
        multiple: isArray(defaultValue),
        advanced: isUndefined(filter.advanced) ? false : filter.advanced,
        exclude: isUndefined(filter.exclude) ? false : filter.exclude,
        default: defaultValue,
      },
    }
  }, {} as ConfigMap)

  const data = filters.reduce((acc, filter) => {
    const key = filter.name
    return {
      ...acc,
      [key]: cloneDeep(filter.default),
    }
  }, {} as DataMap)

  const defaultGlobalOptions: GeneralFilterOptions = {
    elastic: false,
    system: undefined,
    subject: undefined,
    globalStore: undefined,
    ...generalOptions,
  }

  const store: Record<string, AllowedFilterData> = defaultGlobalOptions.globalStore
    ? defaultGlobalOptions.globalStore
    : reactive({})

  if (isUndefined(defaultGlobalOptions.globalStore)) {
    Object.keys(data).forEach((key) => {
      // Type assertion to satisfy TS:
      ;(store as DataMap)[key] = data[key]
    })
  }

  const filterConfig = reactive({
    _general: defaultGlobalOptions,
    fields: reactive(config),
  }) as FilterConfig<F>

  return {
    filterConfig,
    filterData: store as FilterData<F>,
  }
}

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
    // pagination.page = 1
    // if (storeId && localStorage) {
    //   localStorage.removeItem(storeId)
    // }
    // if (callback) callback()
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
