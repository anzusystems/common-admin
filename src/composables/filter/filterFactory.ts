import { type MaybeRef, reactive, ref } from 'vue'
import { cloneDeep, isArray, isUndefined } from '@/utils/common.ts'
import type { ValueObjectOption } from '@/types/ValueObject.ts'

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
          items: resolveValue(filter.items, ref([])),
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

export function useFilterHelpers<
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

  const resetFilter = (filterData: FilterData<F>, filterConfig: FilterConfig<F>) => {
    clearAll(filterData, filterConfig)
  }

  const iterateFilterDataKeys = (filterData: FilterData<F>) => {
    ;(Object.keys(filterData) as Array<keyof FilterData<F>>).forEach((key) => {
      console.log(`Key: ${String(key)}, Value: ${filterData[key]}`)
    })
  }

  return {
    clearOne,
    clearAll,
    resetFilter,
    iterateFilterDataKeys,
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
  items?: MaybeRef<ValueObjectOption<string>[]> | MaybeRef<ValueObjectOption<number>[]>
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
  items: MaybeRef<ValueObjectOption<string>[]> | MaybeRef<ValueObjectOption<number>[]>
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
