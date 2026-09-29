import {
  type Component,
  type ComponentObjectPropsOptions,
  defineComponent,
  type DefineSetupFnComponent,
  type ExtractPropTypes,
  type ExtractPublicPropTypes,
  h,
  type PropType,
  provide,
  type Ref,
  watch,
} from 'vue'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { Pagination } from '@/domains/api/composables/pagination'
import type { CollabComponentConfig } from '@/domains/collab/types/Collab'
import type { DatatableSortBy } from '@/domains/filters/datatable/utils/datatableColumns'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { AFormFieldValidation } from '@/shared/types/Validation'
import type { ValueObjectOption } from '@/shared/types/ValueObject'

export interface RemoteSelectActions<T extends IntegerId | DocId> {
  fetchItems: (
    pagination: Ref<Pagination>,
    filterData: FilterData,
    filterConfig: FilterConfig
  ) => Promise<ValueObjectOption<T>[]>
  fetchItemsByIds: (ids: T[]) => Promise<ValueObjectOption<T>[]>
}

export interface RemoteInnerFilter {
  filterConfig: FilterConfig
  filterData: FilterData
}

/**
 * What the list of a scoped autocomplete depends on (a site group, an ext system): the autocomplete keeps
 * its fetched list across a model reset and prefetches once, so a changed scope has to remount it.
 */
export interface RemoteAutocompleteScope<P> {
  /** The scope, `undefined` while unset. Also the key of the inner autocomplete: a change remounts it. */
  of: (props: P) => unknown
  /** The field is disabled while the scope is unset, when this says the scope is required. */
  requiredWhen?: (props: P) => boolean
  /**
   * The form autocomplete clears its model (`[]` when `multiple`, else `null`) when the scope changes from
   * a set value, as the scoped wrappers did (default `true`). A filter never does: its value outlives a
   * sibling filter's change.
   */
  reset?: boolean
}

export interface CreateRemoteAutocompleteOptions<
  T extends IntegerId | DocId,
  PO extends ComponentObjectPropsOptions = Record<never, never>,
> {
  /** The component's name, for devtools and warnings. */
  name: string
  /**
   * The component's own props, read by the options below and not passed to the autocomplete. Declared,
   * so they are reactive and booleans are cast.
   */
  props?: PO
  /** Called in the component's setup, as the wrappers did; with the component's props when it has `props`. */
  useSelectActions: (props: ExtractPropTypes<PO>) => RemoteSelectActions<T>
  /** Called in the component's setup; provided as the inner filter of the autocomplete. */
  useInnerFilter: () => RemoteInnerFilter
  /**
   * Inner filter fields that follow the props, written in setup -- before the autocomplete's first fetch
   * -- and again on every change. Every key is written each time: return `null` for an unset one.
   */
  filterFromProps?: (props: ExtractPropTypes<PO>) => Record<string, unknown>
  scope?: RemoteAutocompleteScope<ExtractPropTypes<PO>>
  filterByField: string
  filterSortBy?: DatatableSortBy
  prefetch?: 'hover' | 'focus' | 'mounted' | false
  /** Props of the autocomplete this one sets unless its caller does, e.g. `{ clearable: true }`. */
  defaults?: Record<string, unknown>
  /** A model value of `0` reaches the autocomplete as `null`: nothing selected. */
  zeroIsEmpty?: boolean
}

/** What a caller can set on a form remote autocomplete; anything else falls through to it as well. */
export interface RemoteAutocompleteProps<M> {
  modelValue: M
  label?: string | undefined
  required?: boolean | undefined
  multiple?: boolean
  clearable?: boolean
  v?: AFormFieldValidation | null
  errorMessage?: string
  hideDetails?: boolean
  hideLabel?: boolean
  filterSortBy?: DatatableSortBy
  loading?: boolean
  collab?: CollabComponentConfig
  disabled?: boolean | undefined
  readonly?: boolean
  chips?: boolean
  closableChips?: boolean
  disableAutoSingleSelect?: boolean
  prefetch?: 'hover' | 'focus' | 'mounted' | false
  minSearchChars?: number
  minSearchText?: string | undefined
}

/** What a caller can set on a filter remote autocomplete; anything else falls through to it as well. */
export interface FilterRemoteAutocompleteProps {
  name: string
  filterSortBy?: DatatableSortBy
  prefetch?: 'hover' | 'focus' | 'mounted' | false
  minSearchChars?: number
  minSearchText?: string | undefined
  placeholder?: string | undefined
}

// Only `update:modelValue` is the component's own; the autocomplete's other events reach it as listeners in the
// attributes, and these types say so.
export type RemoteAutocompleteComponent<M, P = unknown> = DefineSetupFnComponent<
  RemoteAutocompleteProps<M> & P,
  {
    'update:modelValue': (value: M) => true
    blur: (value: M) => true
    focus: (value: M) => true
    searchChange: (text: string) => true
    searchChangeDebounced: (text: string) => true
  }
>

export type FilterRemoteAutocompleteComponent<P = unknown> = DefineSetupFnComponent<FilterRemoteAutocompleteProps & P>

// A value the caller leaves `undefined` falls back to the default, as a prop default of the wrappers
// this replaces did, instead of overriding it.
const defined = (attrs: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(attrs).filter(([, value]) => value !== undefined))

const base = <T extends IntegerId | DocId, PO extends ComponentObjectPropsOptions>(
  options: CreateRemoteAutocompleteOptions<T, PO>,
  props: ExtractPropTypes<PO>
) => {
  const { fetchItems, fetchItemsByIds } = options.props
    ? options.useSelectActions(props)
    : (options.useSelectActions as () => RemoteSelectActions<T>)()
  const { filterConfig, filterData } = options.useInnerFilter()
  const { filterFromProps } = options
  if (filterFromProps) {
    watch(
      () => filterFromProps(props),
      (fields) => Object.assign(filterData, fields),
      { immediate: true }
    )
  }
  provide(FilterInnerConfigKey, filterConfig)
  provide(FilterInnerDataKey, filterData)
  const { scope } = options
  const scopeKey = () => {
    const value = scope?.of(props)
    return value === undefined ? undefined : JSON.stringify(value)
  }
  const scoped = () => {
    if (!scope) return {}
    // Past the caller's attrs: an unset required scope disables the field whatever the caller says. Left
    // out otherwise, so the caller's `disabled`, or its absence (the collab lock), goes through.
    return { key: scopeKey(), ...(scope.requiredWhen?.(props) && scopeKey() === undefined ? { disabled: true } : {}) }
  }
  return {
    bound: {
      ...options.defaults,
      fetchItems,
      fetchItemsByIds,
      filterByField: options.filterByField,
      ...(options.filterSortBy === undefined ? {} : { filterSortBy: options.filterSortBy }),
      ...(options.prefetch === undefined ? {} : { prefetch: options.prefetch }),
    },
    scopeKey,
    scoped,
  }
}

/**
 * `M` is the model's type: by default one id, several, or `null`; a caller that binds a value which
 * may be `undefined` needs `T | T[] | null | undefined`.
 *
 * A remote autocomplete of one entity, which an admin wrote as a component of its own for each: the
 * entity's select actions and inner filter, the field it searches by, and the props it sets. The
 * caller's props, listeners and slots all reach `AFormRemoteAutocomplete`, and win over `defaults`.
 *
 * In an SFC's plain `<script lang="ts">`:
 * ```ts
 * export default createRemoteAutocomplete({
 *   name: 'DeskRemoteAutocomplete',
 *   useSelectActions: useDeskSelectActions,
 *   useInnerFilter: useDeskInnerFilter,
 *   filterByField: 'name',
 *   prefetch: 'hover',
 *   defaults: { clearable: true },
 * })
 * ```
 */
export function createRemoteAutocomplete<
  T extends IntegerId | DocId = IntegerId,
  M extends T | T[] | null | undefined = T | T[] | null,
  PO extends ComponentObjectPropsOptions = Record<never, never>,
>(options: CreateRemoteAutocompleteOptions<T, PO>): RemoteAutocompleteComponent<M, ExtractPublicPropTypes<PO>> {
  return defineComponent({
    name: options.name,
    inheritAttrs: false,
    props: {
      ...options.props,
      modelValue: { type: null as unknown as PropType<M>, required: true },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, slots, emit }) {
      const { bound, scopeKey, scoped } = base(options, props as ExtractPropTypes<PO>)
      if (options.scope && options.scope.reset !== false) {
        watch(scopeKey, (now, before) => {
          if (before === undefined || now === before) return
          // `multiple` is the caller's attribute, a bare one arriving as ''.
          emit('update:modelValue', (attrs.multiple === '' || attrs.multiple === true ? [] : null) as M)
        })
      }
      return () =>
        h(
          AFormRemoteAutocomplete as Component,
          {
            ...bound,
            ...defined(attrs),
            ...scoped(),
            modelValue: options.zeroIsEmpty && props.modelValue === 0 ? null : props.modelValue,
            'onUpdate:modelValue': (value: M) => emit('update:modelValue', value),
          },
          slots
        )
    },
  }) as unknown as RemoteAutocompleteComponent<M, ExtractPublicPropTypes<PO>>
}

/** `createRemoteAutocomplete` for a filter: the caller's `name` picks the filter field. */
export function createFilterRemoteAutocomplete<
  T extends IntegerId | DocId = IntegerId,
  PO extends ComponentObjectPropsOptions = Record<never, never>,
>(options: CreateRemoteAutocompleteOptions<T, PO>): FilterRemoteAutocompleteComponent<ExtractPublicPropTypes<PO>> {
  return defineComponent({
    name: options.name,
    inheritAttrs: false,
    props: { ...options.props },
    setup(props, { attrs, slots }) {
      const { bound, scoped } = base(options, props as ExtractPropTypes<PO>)
      return () => h(AFilterRemoteAutocomplete as Component, { ...bound, ...defined(attrs), ...scoped() }, slots)
    },
  }) as unknown as FilterRemoteAutocompleteComponent<ExtractPublicPropTypes<PO>>
}
