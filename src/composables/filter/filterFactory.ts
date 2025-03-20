import { reactive, type Ref } from 'vue'
import { cloneDeep, isArray, isUndefined } from '@/utils/common.ts'

export type AllowedDefault = number | number[] | string | string[] | null | undefined | boolean

export interface GeneralFilterOptions {
  elastic: boolean
  system: string | undefined
  subject: string | undefined
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

export interface MakeFilterOption<T extends AllowedDefault = AllowedDefault> {
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

export interface FilterField<T extends AllowedDefault = AllowedDefault> {
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

export type FilterConfig<F extends readonly MakeFilterOption[]> = {
  _general: GeneralFilterOptions
  fields: {
    [K in F[number] as K['name']]: FilterField
  }
}

export type FilterData<F extends readonly MakeFilterOption[]> = {
  [K in F[number] as K['name']]: K['default']
}

/**
 * Accepts an array of filter options and an optional global options object.
 * Returns two reactive objects:
 * - filterConfig: { _general: global options, fields: mapping from filter name to its configuration }
 * - filterData: flat mapping from filter name to its current value.
 *
 * Usage (with as const for best inference):
 *
 * const { filterConfig, filterData } = createFilters(
 *   [
 *     { name: 'docId', advanced: true, default: null },
 *     { name: 'text', default: '' },
 *     { name: 'count', default: 0 },
 *     { name: 'modifiedAtFrom', default: dateTimeStartOfDay(-100) },
 *     { name: 'modifiedAtUntil', default: dateTimeEndOfDay() }
 *   ] as const,
 *   { elastic: true }
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
    [K in F[number] as K['name']]: FilterField
  }
  type DataMap = {
    [K in F[number] as K['name']]: K['default']
  }

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

  const data = filters.reduce((acc, filter) => {
    const key = filter.name
    return {
      ...acc,
      [key]: cloneDeep(filter.default),
    }
  }, {} as DataMap)

  // Merge provided global options with a default.
  const defaultGlobalOptions: GeneralFilterOptions = {
    elastic: false,
    system: undefined,
    subject: undefined,
    ...generalOptions,
  }

  return {
    filterConfig: reactive({
      _general: defaultGlobalOptions,
      fields: reactive(config),
    }) as {
      _general: GeneralFilterOptions
      fields: ConfigMap
    },
    filterData: reactive(data) as DataMap,
  }
}

// export function useFilterHelpers(storeId: string | undefined = undefined) {
export function useFilterHelpers() {
  const clearOne = (model: Ref<AllowedDefault>, fieldConfig: FilterField) => {
    if (!fieldConfig.clearable) return
    model.value = cloneDeep(fieldConfig.default)
    // fieldConfig.error = ''
  }

  // const clearAll = (filterBag: FilterBag) => {
  //   for (const filterName in filterBag) {
  //     clearOne(filterBag[filterName])
  //   }
  // }

  // const clearAllErrors = (filterBag: FilterBag) => {
  //   for (const filterName in filterBag) {
  //     filterBag[filterName].error = ''
  //   }
  // }

  // const loadStoredFilter = (filterBag: FilterBag, options: LoadStoredFilterOptions = {}) => {
  //   if (!storeId || !localStorage) return
  //   const { showAdvancedFilter, callback } = options
  //   let containsAdvanced = false
  //   const stored = localStorage.getItem(storeId)
  //   if (!stored) return
  //   const storedData = JSON.parse(stored)
  //   if (!isObject(storedData)) return
  //   for (const filterName in filterBag) {
  //     try {
  //       // @ts-ignore
  //       if (!isUndefined(storedData[filterName])) {
  //         // @ts-ignore
  //         filterBag[filterName].model = storedData[filterName]
  //         if (filterBag[filterName].advanced) {
  //           containsAdvanced = true
  //         }
  //       }
  //     } catch (e) {
  //       //
  //     }
  //   }
  //   if (showAdvancedFilter && containsAdvanced) showAdvancedFilter.value = true
  //   if (callback) callback(containsAdvanced)
  // }

  // const storeFilter = (filterBag: FilterBag) => {
  //   if (!storeId || !localStorage) return
  //   const data: Record<string, any> = {}
  //   for (const filterName in filterBag) {
  //     try {
  //       if (
  //         !filterName.startsWith('_') &&
  //         !isUndefined(filterBag[filterName].model) &&
  //         !isNull(filterBag[filterName].model) &&
  //         !isEmptyObject(filterBag[filterName].model) &&
  //         !isEmptyArray(filterBag[filterName].model) &&
  //         filterBag[filterName].model !== filterBag[filterName].default
  //       ) {
  //         data[filterName] = filterBag[filterName].model
  //       }
  //     } catch (e) {
  //       //
  //     }
  //   }
  //   if (isEmptyObject(data)) return
  //   localStorage.setItem(storeId, JSON.stringify(data))
  // }

  // const resetFilter = (filterBag: FilterBag, pagination: Pagination, callback?: any) => {
  //   clearAll(filterBag)
  //   pagination.page = 1
  //   if (storeId && localStorage) {
  //     localStorage.removeItem(storeId)
  //   }
  //   if (callback) callback()
  // }

  // const submitFilter = (filterBag: FilterBag, pagination: Pagination, callback: () => any) => {
  //   clearAllErrors(filterBag)
  //   storeFilter(filterBag)
  //   pagination.page = 1
  //   callback()
  // }

  return {
    // clearAllErrors,
    // clearAll,
    clearOne,
    // resetFilter,
    // submitFilter,
    // loadStoredFilter,
  }
}
