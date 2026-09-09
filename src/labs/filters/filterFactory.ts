import { getCurrentInstance, provide, reactive, type Ref, toRaw } from 'vue'
import { datatablePageKey, useDatatablePageStore } from '@/composables/system/datatablePageStore'
import { DatatablePageStoreKey } from '@/labs/filters/filterInjectionKeys'
import {
  cloneDeep,
  isArray,
  isBoolean,
  isEmptyArray,
  isEmptyObject,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from '@/utils/common'
import type { AnyFn } from '@vueuse/core'
import type { Pagination } from '@/labs/filters/pagination'
import { type DatatableSortBy, SortOrder } from '@/composables/system/datatableColumns'
import { stringToBooleanExact, stringToNumber } from '@/utils/string'
import type { ValueObjectOption } from '@/types/ValueObject'

export type FilterStoreIdentifier = { system: string; subject: string }

const SORT_URL_PARAM = '_sort'
const END_FILTER_MARKER = '~'

// `URLSearchParams` percent-encodes characters a URL fragment accepts verbatim, and vue-router
// then runs `encodeURI` over the hash, which escapes the `%` a second time — `_sort=id%2Cdesc`
// arrives as `id%252Cdesc` and the sort is silently lost. Handing these back keeps a built hash
// stable through `router.push({ hash })`. `~` stays encoded because the end marker relies on it
// never occurring inside a value; `&`, `=` carry the structure, `+` reads back as a space.
const RELAXED_IN_HASH: Record<string, string> = {
  '%2C': ',',
  '%3A': ':',
  '%2F': '/',
  '%40': '@',
  '%24': '$',
  '%21': '!',
  '%27': "'",
  '%28': '(',
  '%29': ')',
  '%3B': ';',
  '%3F': '?',
}
const relaxHashEncoding = (value: string) =>
  value.replace(/%(2C|3A|2F|40|24|21|27|28|29|3B|3F)/g, (match) => RELAXED_IN_HASH[match])

// `structuredClone` gives every array default a fresh identity, so `!==` is always true for them
// and an array default would be written into the url on every submit.
const isSameFilterValue = (a: AllowedFilterValues, b: AllowedFilterValues): boolean => {
  if (isArray(a) && isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index])
  }
  return a === b
}

const encodeFilterHash = (
  data: Record<string, AllowedFilterValues>,
  sortBy?: DatatableSortBy,
): string => {
  const params = new URLSearchParams()
  for (const key in data) {
    const value = data[key]
    if (isUndefined(value) || isNull(value)) continue
    if (isArray(value) && isEmptyArray(value)) continue
    if (isObject(value) && isEmptyObject(value)) continue
    if (isString(value) && value.length === 0) continue
    params.set(key, isArray(value) ? value.join(',') : String(value))
  }
  if (sortBy) {
    params.set(SORT_URL_PARAM, `${sortBy.key},${sortBy.order}`)
  }
  if (params.size === 0) return ''
  return relaxHashEncoding(params.toString()) + END_FILTER_MARKER
}

/**
 * Hash for a filter link, with values equal to their default left out.
 *
 * Pair it with `router.push({ name, hash })`, which needs the leading `#` — without it vue-router
 * glues the value onto the path instead. A hash still containing `%` (diacritics, `&`, `=`) does
 * not survive that trip; check with `isRouterSafeHash` and fall back to assigning
 * `window.location.hash` after navigating. Returns an empty string when nothing differs from
 * the defaults.
 */
export function buildFilterHash<F extends readonly MakeFilterOption<string>[]>(
  filterConfig: FilterConfig<F>,
  filters: Partial<Record<keyof FilterData<F> & string, AllowedFilterValues>>,
  sortBy?: DatatableSortBy,
): string {
  const data: Record<string, AllowedFilterValues> = {}
  for (const [key, value] of Object.entries(filters) as [string, AllowedFilterValues][]) {
    const field = filterConfig.fields[key as keyof FilterConfig<F>['fields']]
    if (isUndefined(field) || isSameFilterValue(value, field.default)) continue
    data[key] = value
  }
  const hash = encodeFilterHash(data, sortBy)
  return hash.length === 0 ? hash : '#' + hash
}

/** Whether `router.push({ hash })` would leave the hash intact — see `buildFilterHash`. */
export const isRouterSafeHash = (hash: string): boolean => !hash.includes('%')

const defaultRenderOptions: FilerRenderOptions = {
  skip: false,
  selected: true,
  xs: undefined,
  sm: undefined,
  md: undefined,
  lg: undefined,
  xl: undefined,
}

export function createFilterStore<F extends readonly MakeFilterOption<string>[]>(
  filterFields: F,
): FilterData<F> {
  return reactive(
    filterFields.reduce((acc, field) => {
      return {
        ...acc,
        [field.name]: cloneDeep(field.default),
      }
    }, {} as FilterData<F>),
  ) as FilterData<F>
}

export function createFilter<F extends readonly MakeFilterOption<string>[]>(
  filterFields: F,
  store: FilterData<F>,
  options?: Partial<GeneralFilterOptions>,
): {
  filterConfig: FilterConfig<F>
  filterData: FilterData<F>
} {
  const config = filterFields.reduce(
    (acc, filter) => {
      const key = filter.name as keyof FilterData<F>
      const defaultValue = cloneDeep(filter.default)

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
    {} as FilterConfig<F>['fields'],
  )

  const defaultGlobalOptions: GeneralFilterOptions = {
    elastic: false,
    system: undefined,
    subject: undefined,
    simpleFilters: false,
    ...options,
  }

  if (defaultGlobalOptions.elastic) {
    defaultGlobalOptions.simpleFilters = true
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
  const clearOne = (
    name: keyof FilterData<F>,
    filterData: FilterData<F>,
    filterConfig: FilterConfig<F>,
  ) => {
    if (!filterConfig.fields[name]?.clearable) return
    filterData[name] = cloneDeep(filterConfig.fields[name].default)
  }

  const clearAll = (filterData: FilterData<F>, filterConfig: FilterConfig<F>) => {
    for (const filterName in filterConfig.fields) {
      clearOne(filterName as keyof FilterData<F>, filterData, filterConfig)
    }
  }
  const clearOneFilterSelected = (
    name: string,
    optionValue: number | string,
    filterData: FilterData<F>,
    filterConfig: FilterConfig<F>,
    filterSelected: Ref<Map<string, ValueObjectOption<string | number>[]>>,
  ) => {
    if (!isClearable(name, filterConfig)) return
    // update selected
    const config = filterConfig.fields[name as keyof FilterConfig<F>['fields']]
    const selectedFound = filterSelected.value.get(name)
    if (selectedFound && selectedFound.length === 1) {
      filterSelected.value.delete(name)
    } else if (selectedFound) {
      const foundIndex = selectedFound.findIndex((item) => item.value === optionValue)
      selectedFound.splice(foundIndex, 1)
    }
    // update data
    if (config.type === 'timeInterval' && config.related) {
      filterData[name as keyof FilterData<F>] = config.default
      filterData[config.related as keyof FilterData<F>] =
        filterConfig.fields[config.related as keyof FilterConfig<F>['fields']].default
    } else if (
      isArray(filterData[name as keyof FilterData<F>]) &&
      (filterData[name as keyof FilterData<F>] as any[]).length > 0
    ) {
      const foundIndex = (filterData[name as keyof FilterData<F>] as any[]).findIndex(
        (item) => item === optionValue,
      )
      const newArray = [...toRaw(filterData[name as keyof FilterData<F>] as any[])]
      newArray.splice(foundIndex, 1)
      filterData[name as keyof FilterData<F>] = newArray as AllowedFilterValues
    } else if (
      isString(filterData[name as keyof FilterData<F>]) ||
      isNumber(filterData[name as keyof FilterData<F>])
    ) {
      filterData[name as keyof FilterData<F>] = config.default
    } else if (isBoolean(filterData[name as keyof FilterData<F>])) {
      filterData[name as keyof FilterData<F>] = config.default
    }
  }

  const clearAllFilterSelected = (
    filterData: FilterData<F>,
    filterConfig: FilterConfig<F>,
    filterSelected: Ref<Map<string, ValueObjectOption<string | number>[]>>,
  ) => {
    for (const key of filterSelected.value.keys()) {
      if (isClearable(key, filterConfig)) {
        filterSelected.value.delete(key)
      }
    }
  }

  const isClearable = (name: string, filterConfig: FilterConfig<F>) => {
    const config = filterConfig.fields[name as keyof FilterConfig<F>['fields']]
    return !(config.mandatory || !config.clearable)
  }

  return {
    clearOne,
    clearAll,
    clearOneFilterSelected,
    clearAllFilterSelected,
    isClearable,
  }
}

interface FilterHelpersMoreOptions {
  storeFiltersLocalStorage: string | boolean // false to disable, string to override store key
  populateUrlParams: boolean
}

const FilterHelpersMoreOptionsDefault = {
  storeFiltersLocalStorage: true,
  populateUrlParams: true,
}

export function useFilterHelpers<
  F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[],
>(
  filterData: FilterData<F>,
  filterConfig: FilterConfig<F>,
  moreOptions: Partial<FilterHelpersMoreOptions> = {},
) {
  const options = { ...FilterHelpersMoreOptionsDefault, ...moreOptions }

  let storeKey: undefined | string = undefined
  if (isString(options.storeFiltersLocalStorage)) {
    storeKey = options.storeFiltersLocalStorage
  } else if (
    isBoolean(options.storeFiltersLocalStorage) &&
    true === options.storeFiltersLocalStorage &&
    isString(filterConfig.general.system) &&
    isString(filterConfig.general.subject)
  ) {
    storeKey = 'tableFilter_' + filterConfig.general.system + '_' + filterConfig.general.subject
  }

  // Independent of `storeFiltersLocalStorage` being on: the remembered page is keyed even when
  // filters are not persisted. A string override is what distinguishes tables sharing a subject.
  const pageStoreKey = isString(options.storeFiltersLocalStorage)
    ? options.storeFiltersLocalStorage
    : datatablePageKey(filterConfig.general.system, filterConfig.general.subject)
  // Called from a datatable's setup, so `ADatatablePagination` picks it up. Guarded because a
  // composable may legitimately be called outside setup, and Vue would warn.
  if (getCurrentInstance()) {
    provide(DatatablePageStoreKey, pageStoreKey)
  }

  const { clearAll } = useFilterClearHelpers<F>()

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
          !isSameFilterValue(value, filterConfig.fields[key].default)
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
    includeSort: boolean,
  ): string => {
    return encodeFilterHash(data, includeSort ? pagination.value.sortBy : undefined)
  }

  const deserializeFilters = (
    hash: string,
  ): { filters: Record<string, AllowedFilterValues>; sortBy: DatatableSortBy } | null => {
    if (!hash) return null
    if (hash.startsWith('#')) hash = hash.substring(1)

    // URLSearchParams percent-encodes `~` in values, so the marker cannot occur inside our own
    // data — a hash without it is foreign or truncated, and null lets localStorage take over.
    const markerIndex = hash.indexOf(END_FILTER_MARKER)
    if (markerIndex === -1) return null
    hash = hash.slice(0, markerIndex)

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
      if (isUndefined(fieldConfig)) {
        console.error(`Filter config not found for ${key}`)
        continue
      }
      const isMultiple = fieldConfig.multiple ?? false

      if (isMultiple) {
        const items = value.split(',')

        const allNumeric = items.every((item) => !isNaN(Number(item)))

        result[key] = allNumeric ? items.map(Number) : items
      } else {
        result[key] = value
      }
    }

    // An empty result would still count as "found", shadowing localStorage.
    if (isEmptyObject(result) && isNull(sortBy)) return null

    return { filters: result, sortBy }
  }

  const updateLocationHash = (serialized: string) => {
    if (options.populateUrlParams === false) return
    window.location.hash = serialized
  }

  const resetLocationHash = () => {
    if (options.populateUrlParams === false) return
    window.location.hash = ''
  }

  const parseLocationHash = () => {
    if (options.populateUrlParams === false) return null
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
    resetLocationHash()
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
    const { consumeStoredPage } = useDatatablePageStore()
    let source: 'hash' | 'localStorage' = 'hash'
    let storedFromHash = parseLocationHash()
    if (isNull(storedFromHash)) {
      source = 'localStorage'
      storedFromHash = loadFilterLocalStorage()
    }
    if (
      isNull(storedFromHash) ||
      (isEmptyObject(storedFromHash.filters) && isNull(storedFromHash.sortBy))
    ) {
      const restoredPage = consumeStoredPage(pageStoreKey)
      if (restoredPage !== null) {
        pagination.value = { ...pagination.value, page: restoredPage }
      }
      if (callback) callback()
      return false
    }

    // A hash naming at least one field is authoritative: it arrives from a link, or from stepping
    // back to an older address, and in both cases it describes the whole view. Without this reset
    // the fields it does not mention keep whatever the module-level filter store still holds from
    // an earlier visit, so the same link lands differently depending on how the user got to it.
    // On a fresh page load the store is already at its defaults and this is a no-op. Local storage
    // keeps merging, because there the absent fields were left out as equal to their default.
    //
    // A hash carrying only `_sort` is excluded on purpose. Unknown keys are dropped before this
    // point, so such a hash also results from a link meant for a different table sharing the page
    // - it must not wipe this one's filter. Only `clearable` fields are reset, as everywhere else.
    const hashDescribesThisView = source === 'hash' && !isEmptyObject(storedFromHash.filters)
    if (hashDescribesThisView) {
      clearAll(filterData, filterConfig)
    }

    for (const filterName in filterData) {
      const key = filterName as keyof FilterData<F>
      let value = storedFromHash.filters[key]
      if (isUndefined(value)) continue
      if (isString(value)) {
        const tryConvertNumber = stringToNumber(value)
        if (!isNull(tryConvertNumber)) {
          value = tryConvertNumber
        } else {
          const tryConvertBoolean = stringToBooleanExact(value)
          if (!isNull(tryConvertBoolean)) {
            value = tryConvertBoolean
          }
        }
      }
      filterData[key] = value
    }
    if (source === 'localStorage' && storeKey && localStorage) {
      const stored = localStorage.getItem(storeKey)
      if (stored) {
        updateLocationHash(stored)
      }
    }
    // Drained either way: the flag means "the next list I land on should restore its page", so
    // leaving it set would hand the remembered page to whichever table comes after this one.
    const restoredPage = consumeStoredPage(pageStoreKey)
    pagination.value = {
      ...pagination.value,
      // A link need not carry the sort. Taking `null` from it would drop `order[...]` from the
      // query, and paging without ORDER BY can repeat or skip rows.
      sortBy: storedFromHash.sortBy ?? pagination.value.sortBy,
      // A hash replaces the view, so a link starts at the first page. A restored page still wins:
      // the flag behind it is only ever set by the close button, which means "I am coming back to
      // this list", and that address carries the list's own hash along with it.
      page: restoredPage ?? (source === 'hash' ? 1 : pagination.value.page),
    }
    if (hashDescribesThisView) {
      // Local storage mirrors the last applied state, so a link becomes the view the user returns
      // to. Re-serialized rather than stored verbatim, to drop values equal to their default.
      // A sort-only hash is not a link to this view, so it does not overwrite what is remembered.
      storeFilterLocalStorage(serializeFilters(getFilterDataForStoring(), pagination, true))
    }
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
  simpleFilters?: boolean
}

export interface FilerRenderOptions {
  skip: boolean
  // Whether the field is shown as a selected-filter chip (FiltersSelected). Default true.
  // Optional for backward compatibility (other admins may construct FilerRenderOptions).
  selected?: boolean
  xs: number | undefined
  sm: number | undefined
  md: number | undefined
  lg: number | undefined
  xl: number | undefined
}

export type FilterVariant =
  | 'search'
  | 'lt'
  | 'in'
  | 'notIn'
  | 'endsWith'
  | 'startsWith'
  | 'memberOf'
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

export type FilterConfig<
  F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[],
> = {
  general: GeneralFilterOptions
  touched: boolean
  fields: {
    [P in F[number]['name']]: FilterField
  }
}

export type FilterData<
  F extends readonly MakeFilterOption<string>[] = readonly MakeFilterOption<string>[],
> = {
  [P in F[number]['name']]: AllowedFilterValues
}

export type FilterStore<T extends readonly { name: string }[]> = {
  [K in T[number]['name']]: AllowedFilterValues
}
