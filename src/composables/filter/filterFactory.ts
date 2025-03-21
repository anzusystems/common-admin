import { reactive, type Ref } from 'vue'
import { cloneDeep, isArray, isUndefined } from '@/utils/common.ts'

export type AllowedFilterData = number | number[] | string | string[] | null | undefined | boolean

export interface GeneralFilterOptions {
  elastic: boolean
  system: string | undefined
  subject: string | undefined
  globalStore: Record<string, AllowedFilterData> | undefined
}

export type FilterVariant =
  | 'search' // used for elastic fields
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

export interface MakeFilterOption<T extends AllowedFilterData = AllowedFilterData> {
  name: string
  variant?: FilterVariant
  titleT?: string
  default: T
  field?: string
  clearable?: boolean
  mandatory?: boolean
  advanced?: boolean
  exclude?: boolean
}

export type MakeFilterOptions = MakeFilterOption[]

export interface FilterField<T extends AllowedFilterData = AllowedFilterData> {
  name: string
  variant: FilterVariant
  titleT?: string
  default: T
  field: string
  clearable: boolean
  mandatory: boolean
  multiple: boolean
  advanced: boolean
  exclude: boolean
}

// Mapped type that builds a config object with keys exactly from filter names.
export type FilterConfig<F extends MakeFilterOption[]> = {
  _general: GeneralFilterOptions
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

// Mapped type for filter data: keys are the filter names and values are their default values.
export type FilterData<F extends MakeFilterOption[]> = {
  [P in F[number]['name']]: F[number] extends { default: infer D } ? D : never
}

export type FilterStore<T extends { name: string; default: any }[]> = {
  [K in T[number]['name']]: Extract<T[number], { name: K }>['default'];
}

/**
 * createFilter creates:
 * - a local reactive filterConfig object (composable, cleaned up when the component unmounts)
 * - a filterData store that is either:
 *    a) the provided reactive store via generalOptions.globalStore or
 *    b) a new reactive store (local)
 *
 * Usage:
 *
 * const { filterConfig, filterData } = createFilter(
 *   [
 *     { name: 'docId', advanced: true, default: null },
 *     { name: 'text', default: '' },
 *     { name: 'count', default: 0 },
 *   ] as const,
 *   { elastic: true, system: 'mySystem', subject: 'mySubject' }
 * );
 */
export function createFilter<F extends MakeFilterOptions>(
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
    [P in F[number]['name']]: F[number] extends { default: infer D } ? D : never
  }

  // Build filter configuration mapping.
  const config = filters.reduce((acc, filter) => {
    const key = filter.name
    const variant: FilterVariant = isUndefined(filter.variant) ? 'eq' : filter.variant
    const defaultValue = filter.default
    let titleT = filter.titleT
    if (isUndefined(titleT) && generalOptions?.system && generalOptions?.subject && filter.name) {
      titleT = generalOptions.system + '.' + generalOptions.subject + '.filter.' + filter.name
    }
    return {
      ...acc,
      [key]: {
        name: key,
        variant,
        titleT,
        field: isUndefined(filter.field) ? '' : filter.field,
        clearable: isUndefined(filter.clearable) ? true : filter.clearable,
        mandatory: isUndefined(filter.mandatory) ? false : filter.mandatory,
        multiple: isArray(defaultValue),
        advanced: isUndefined(filter.advanced) ? false : filter.advanced,
        exclude: isUndefined(filter.exclude) ? false : filter.exclude,
        default: defaultValue,
      },
    }
  }, {} as ConfigMap)

  // Build initial filter data mapping.
  const data = filters.reduce((acc, filter) => {
    const key = filter.name
    return {
      ...acc,
      [key]: cloneDeep(filter.default),
    }
  }, {} as DataMap)

  // Merge provided global options with defaults.
  const defaultGlobalOptions: GeneralFilterOptions = {
    elastic: false,
    system: undefined,
    subject: undefined,
    globalStore: undefined,
    ...generalOptions,
  }

  // Use provided globalStore if available, otherwise create a new reactive store.
  const store: Record<string, AllowedFilterData> = defaultGlobalOptions.globalStore
    ? defaultGlobalOptions.globalStore
    : reactive({})

  // Merge the filter data into the chosen store.
  Object.assign(store, data)

  // Create local reactive filter configuration.
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
  const clearOne = (model: Ref<AllowedFilterData>, fieldConfig: FilterField) => {
    if (!fieldConfig.clearable) return
    model.value = cloneDeep(fieldConfig.default)
  }

  const iterateFilterDataKeys = (filterData: Record<string, AllowedFilterData>) => {
    Object.keys(filterData).forEach((key: string) => {
      const value = filterData[key]
      console.log(`Key: ${key}, Value: ${value}`)
    })
  }

  return {
    clearOne,
    iterateFilterDataKeys,
  }
}
