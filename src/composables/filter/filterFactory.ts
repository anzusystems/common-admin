import { reactive } from 'vue'
import { cloneDeep, isUndefined } from '@/utils/common.ts'

export type AllowedDefault = number | number[] | string | string[] | null | undefined | boolean

export interface AdditionalFilterOptions {
  elastic: boolean;
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

export interface MakeFilterOptions<T extends AllowedDefault> {
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

export interface FilterField<T extends AllowedDefault> {
  name: string;
  variant?: FilterVariant;
  titleT?: string;
  default: T;
  field?: string;
  clearable?: boolean;
  mandatory?: boolean;
  advanced?: boolean;
  exclude?: boolean;
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
export function createFilter<
  F extends readonly MakeFilterOptions<AllowedDefault>[]
>(
  filters: F,
  generalOptions?: Partial<AdditionalFilterOptions>
): {
  filterConfig: {
    _general: AdditionalFilterOptions;
    fields: {
      [K in F[number] as K['name']]: {
        name: K['name'];
        variant: NonNullable<K['variant']>;
        titleT?: K['titleT'];
        field: string;
        clearable: boolean;
        mandatory: boolean;
        advanced: boolean;
        exclude: boolean;
        default: K['default'];
      }
    }
  };
  filterData: {
    [K in F[number] as K['name']]: K['default'];
  };
} {
  type ConfigMap = {
    [K in F[number] as K['name']]: {
      name: K['name'];
      variant: NonNullable<K['variant']>;
      titleT?: K['titleT'];
      field: string;
      clearable: boolean;
      mandatory: boolean;
      advanced: boolean;
      exclude: boolean;
      default: K['default'];
    }
  }
  type DataMap = {
    [K in F[number] as K['name']]: K['default'];
  }

  const config = filters.reduce((acc, filter) => {
    const key = filter.name
    const variant: FilterVariant = isUndefined(filter.variant) ? 'eq' : filter.variant
    const defaultValue = filter.default
    return {
      ...acc,
      [key]: {
        name: key,
        variant,
        titleT: filter.titleT,
        field: isUndefined(filter.field) ? '' : filter.field,
        clearable: isUndefined(filter.clearable) ? true : filter.clearable,
        mandatory: isUndefined(filter.mandatory) ? false : filter.mandatory,
        advanced: isUndefined(filter.advanced) ? false : filter.advanced,
        exclude: isUndefined(filter.exclude) ? false : filter.exclude,
        default: defaultValue,
      }
    }
  }, {} as ConfigMap)

  const data = filters.reduce((acc, filter) => {
    const key = filter.name
    return {
      ...acc,
      [key]: cloneDeep(filter.default)
    }
  }, {} as DataMap)

  // Merge provided global options with a default.
  const defaultGlobalOptions: AdditionalFilterOptions = { elastic: false, ...generalOptions }

  return {
    filterConfig: reactive({
      _general: defaultGlobalOptions,
      fields: reactive(config)
    }) as {
      _general: AdditionalFilterOptions;
      fields: ConfigMap;
    },
    filterData: reactive(data) as DataMap,
  }
}
