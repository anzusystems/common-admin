import { reactive } from 'vue'
import { cloneDeep, isArray, isUndefined } from '@/utils/common.ts'

export function createFilter<F extends readonly MakeFilterOption<any, any>[]>(
  filterFields: F,
  store: FilterData<F>,
  options?: Partial<GeneralFilterOptions>,
): {
  filterConfig: FilterConfig<F>
  filterData: FilterData<F>
} {
  type ConfigMap = {
    [P in F[number]['name']]: FilterField
  }

  const defaultRenderOptions: FilerRenderOptions = {
    skip: false,
    xs: 12,
    sm: 6,
    md: 4,
    lg: 3,
    xl: 2,
  }

  const config = filterFields.reduce((acc, filter) => {
    const key = filter.name
    const type: FilterType = isUndefined(filter.type) ? 'custom' : filter.type
    const variant: FilterVariant = isUndefined(filter.variant) ? 'eq' : filter.variant
    const defaultValue = (isUndefined(filter.default) ? null : filter.default) as AllowedFilterData
    let titleT = filter.titleT
    if (isUndefined(titleT) && options?.system && options?.subject && filter.name) {
      titleT = `${options.system}.${options.subject}.filter.${filter.name}`
    }
    return {
      ...acc,
      [key]: {
        name: key,
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
          : { ...defaultRenderOptions, ...filter.render  },
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

export type AllowedFilterData = number | number[] | string | string[] | null | undefined | boolean

export interface GeneralFilterOptions {
  system?: string | undefined
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

// eslint-disable-next-line @stylistic/max-len
export interface MakeFilterOption<TName extends string = string, TDefault extends AllowedFilterData = AllowedFilterData> {
  name: TName
  type?: FilterType
  variant?: FilterVariant
  titleT?: string
  default: TDefault
  field?: string
  clearable?: boolean
  mandatory?: boolean
  advanced?: boolean
  exclude?: boolean
  render?: Partial<FilerRenderOptions>
}

export type FilterFieldStore<T extends string, V extends AllowedFilterData> = {
  name: T
  default: V
}

export interface FilterField<T extends AllowedFilterData = AllowedFilterData> {
  name: string
  type: FilterType
  variant: FilterVariant
  titleT?: string
  default: T
  field: string
  clearable: boolean
  mandatory: boolean
  multiple: boolean
  advanced: boolean
  exclude: boolean
  render: FilerRenderOptions
}

export type FilterConfig<F extends readonly MakeFilterOption[] = any> = {
  general: GeneralFilterOptions
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

export type FilterData<F extends readonly MakeFilterOption[] = any> = {
  [P in F[number]['name']]: F[number] extends { default: infer D } ? D : never
}

export type FilterStore<T extends readonly FilterFieldStore<string, AllowedFilterData>[]> = {
  [K in T[number]['name']]: Extract<T[number], { name: K }>['default']
}
