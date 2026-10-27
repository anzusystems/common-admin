<script lang="ts" setup generic="T extends string | number">
import { watchDebounced } from '@vueuse/core'
import { computed, getCurrentInstance, inject, type Ref, ref, watch } from 'vue'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { isArray, isBoolean, isEmpty, isNull, isUndefined } from '@/shared/utils/common'
import { useI18n } from 'vue-i18n'
import { type FilterConfig, type FilterData, useFilterClearHelpers } from '@/domains/filters/composables/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import type { DatatableSortBy } from '@/domains/filters/datatable/utils/datatableColumns'
import { type Pagination, usePagination } from '@/domains/api/composables/pagination'
import { useAlerts } from '@/domains/system/composables/alerts'

type ModelValueType = T | T[] | null | undefined

const props = withDefaults(
  defineProps<{
    name: string
    fetchItems: (
      pagination: Ref<Pagination>,
      filterData: FilterData,
      filterConfig: FilterConfig
    ) => Promise<ValueObjectOption<T>[]>
    fetchItemsByIds: (ids: T[]) => Promise<ValueObjectOption<T>[]>
    filterByField: string
    filterSortBy?: DatatableSortBy
    prefetch?: 'hover' | 'focus' | 'mounted' | false
    minSearchChars?: number
    minSearchText?: string | undefined
    placeholder?: string | undefined
  }>(),
  {
    filterSortBy: null,
    prefetch: false,
    minSearchChars: 2,
    minSearchText: undefined,
    placeholder: undefined,
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const filterInnerConfig = inject(FilterInnerConfigKey)
const filterInnerData = inject(FilterInnerDataKey)

const componentName = getCurrentInstance()?.type.__name

if (
  isUndefined(submitResetCounter) ||
  isUndefined(filterSelected) ||
  isUndefined(filterData) ||
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name]) ||
  isUndefined(filterInnerConfig) ||
  isUndefined(filterInnerData)
) {
  throw new Error(`[${componentName}] Incorrect provide/inject config.`)
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const filterByFieldProp = props.filterByField
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const filterSortByProp = props.filterSortBy

if (isUndefined(filterInnerConfig.fields[filterByFieldProp]) || isUndefined(filterInnerData[filterByFieldProp])) {
  throw new Error(
    `[${componentName}] Incorrect filter inner config. ` +
      `FilterByField is '${filterByFieldProp}' and available options are ${Object.keys(filterInnerData).join(', ')}.`
  )
}

const filterConfigCurrent = computed(() => filterConfig.fields[props.name]!)

const SEARCH_DEBOUNCE_MS = 300

const selected = ref<any>([])
const search = ref('')
const isFocused = ref(false)
const modelValueAutocomplete = ref<ValueObjectOption<T> | ValueObjectOption<T>[] | null>(null)
const apiRequestCounter = ref(0)

const { t } = useI18n()

const onBlur = () => {
  isFocused.value = false
}

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { pagination } = usePagination(isNull(filterSortByProp) ? null : filterSortByProp.key, filterSortByProp?.order)

const fetchedItems = ref<ValueObjectOption<T>[]>([])
const selectedItemsCache = ref<ValueObjectOption<T>[]>([])
const isFirstLoad = ref(true)
const prefetchCompleted = ref(false)

const allItems = computed<ValueObjectOption<T>[]>(() => {
  const itemsMap = new Map<T, ValueObjectOption<T>>()
  const addToMap = (items: ValueObjectOption<T>[]) => {
    items.forEach((item) => {
      itemsMap.set(item.value, {
        value: item.value,
        title: item.title,
        subtitle: item.subtitle,
      } as ValueObjectOption<T>)
    })
  }

  addToMap(selectedItemsCache.value as ValueObjectOption<T>[])
  addToMap(fetchedItems.value as ValueObjectOption<T>[])

  return Array.from(itemsMap.values())
})

// Counts running requests (by ids, search, prefetch). The spinner stays on until the last one ends.
// A single flag let a read by ids hide the spinner of a search still running, and the reverse.
const requestsRunning = ref(0)
const loading = computed(() => requestsRunning.value > 0)

let byIdsCounter = 0
const resetToEmptyState = (value: ModelValueType) => {
  byIdsCounter++
  selectedItemsCache.value = []
  selected.value = isArray(value) ? [] : null
  modelValueAutocomplete.value = isArray(value) ? [] : null
  updateFilterSelected(selected.value)
}

const updateSelected = (value: T[] | T) => {
  const findItem = (id: T): ValueObjectOption<T> =>
    allItems.value.find((obj) => obj.value === id) ?? ({ title: `${id}`, value: id } as ValueObjectOption<T>)
  return isArray(value) ? value.map(findItem) : findItem(value)
}

const loadListItems = async (ids: T[] | T) => {
  const requestId = ++byIdsCounter
  requestsRunning.value++

  try {
    const idsArray = isArray(ids) ? ids : [ids]
    try {
      const res = await props.fetchItemsByIds(idsArray)
      if (requestId !== byIdsCounter) return selectedItemsCache.value
      selectedItemsCache.value = res
      const selectedNewValue = updateSelected(ids)
      selected.value = selectedNewValue
      modelValueAutocomplete.value = selectedNewValue
      updateFilterSelected(selected.value)
    } catch (e) {
      showErrorsDefault(e)
    }
    return selectedItemsCache.value
  } finally {
    requestsRunning.value--
  }
}

const { showErrorsDefault } = useAlerts()

const apiSearch = async (query: string, requestCounter: number) => {
  requestsRunning.value++
  filterInnerData[filterByFieldProp] = query
  try {
    const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
    if (requestCounter === apiRequestCounter.value) fetchedItems.value = res
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    requestsRunning.value--
  }
}

const tryAutoFetch = async (mode: 'focus' | 'hover' | 'mounted') => {
  if (props.prefetch === false || props.prefetch !== mode) return
  if (loading.value) return
  if (prefetchCompleted.value) return

  requestsRunning.value++
  try {
    const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
    if (apiRequestCounter.value === 0) {
      fetchedItems.value = res
    }
    prefetchCompleted.value = true
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    requestsRunning.value--
  }
}

const onFocus = async () => {
  isFocused.value = true
  await tryAutoFetch('focus')
}

const onMouseEnter = async () => {
  await tryAutoFetch('hover')
}

const singleItemSelectedTitle = computed(() => {
  if (!filterConfigCurrent.value.multiple && selectedItemsCache.value[0]) {
    return selectedItemsCache.value[0].title
  }
  return undefined
})

// Clearing the field first emits a `null` search. Reading its length threw when the field had no focus.
const onSearchUpdate = (query: string | null) => {
  const text = query ?? ''
  if (!filterConfigCurrent.value.multiple && !isFocused.value && text.length === 0) return // vuetify fix
  if (singleItemSelectedTitle.value === text) return
  search.value = text
}

const { clearOne } = useFilterClearHelpers()

/**
 * The value of the filter its watcher (below) saw last.
 */
let watchedValue: unknown

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

// Clearing empties the filter in one step, so the filter watcher
// fetches once for an empty search and keeps only the newest answer.
// A single-value filter cleared onto its own default does not
// change, so its watcher does nothing. Its item is restored here.
// A clear that ends on a default value fetches the empty search here
// through the counter, because the watcher only fetches for an empty value.
const onClickClear = () => {
  clearField()
  const value = filterData[props.name]
  if (isEmpty(value)) return
  if (value === watchedValue) loadListItems(value as T[] | T)
  apiRequestCounter.value++
  apiSearch('', apiRequestCounter.value)
}

watchDebounced(
  search,
  (newValue: string | null, oldValue: string | null) => {
    const query = newValue ?? ''
    if (query === (oldValue ?? '')) return
    if (query.length > 0 && query.length < props.minSearchChars) return
    if (query.length === 0 && props.prefetch === false) {
      fetchedItems.value = []
      return
    }
    apiRequestCounter.value++
    apiSearch(query, apiRequestCounter.value)
  },
  { debounce: SEARCH_DEBOUNCE_MS }
)

const checkFirstLoad = async () => {
  await tryAutoFetch('mounted')
}

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (filterConfigCurrent.value.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (filterConfigCurrent.value.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (filterConfigCurrent.value.variant === 'search') return t('common.model.filterPlaceholder.contains')
  return ''
})

const noDataText = computed(() => {
  if (loading.value) {
    return '$vuetify.loading'
  }
  if (fetchedItems.value.length === 0 && search.value.length < props.minSearchChars) {
    return isUndefined(props.minSearchText)
      ? t('common.filter.filterMinChars', { min: props.minSearchChars })
      : props.minSearchText
  }
  return undefined
})

const onSelectedUpdate = (newValue: any) => {
  filterConfig.touched = true
  let final: null | string | number | string[] | number[] = null
  if (isArray(newValue)) {
    final = newValue.map((item: any) => item.value) as string[] | number[]
  } else if (!isNull(newValue)) {
    final = newValue.value
  }
  filterData[props.name] = final
  emit('change')
}

// Closing a chip (`closable-chips`) removes its value from the filter, like unticking it in the list.
// A single-value filter is cleared like the field's clear, since the chip slot draws its value as a chip too.
const onChipCloseClick = (closedItem: ValueObjectOption<T>) => {
  if (!isArray(selected.value)) {
    selected.value = null
    onSelectedUpdate(null)
    onClickClear()
    return
  }
  selected.value = (selected.value as ValueObjectOption<T>[]).filter((item) => item.value !== closedItem.value)
  onSelectedUpdate(selected.value)
}

const updateFilterSelected = (
  newValue: ValueObjectOption<string | number> | ValueObjectOption<string | number>[] | null
) => {
  filterSelected.value.delete(props.name)
  if ((isArray(newValue) && newValue.length === 0) || isNull(newValue)) {
    filterSelected.value.delete(props.name)
    return
  }
  if (isArray(newValue)) {
    filterSelected.value.set(
      props.name,
      newValue.map((item) => ({ title: item.title, value: item.value }))
    )
    return
  }
  filterSelected.value.set(props.name, [{ title: newValue.title, value: newValue.value }])
}

watch(
  () => filterData[props.name],
  async (newValueFilterData, oldValueFilterData) => {
    watchedValue = newValueFilterData
    if (newValueFilterData === oldValueFilterData || isBoolean(newValueFilterData)) return
    const newValue = newValueFilterData as ModelValueType
    if (isFirstLoad.value) {
      isFirstLoad.value = false
      await checkFirstLoad()
    }
    if (isEmpty(newValue)) {
      resetToEmptyState(newValue)
      if (!isUndefined(oldValueFilterData)) {
        apiRequestCounter.value++
        await apiSearch('', apiRequestCounter.value)
      }
      return
    }
    await loadListItems(newValue as T[] | T)
  },
  { immediate: true }
)
</script>

<template>
  <VAutocomplete
    v-model="selected"
    :items="allItems"
    no-filter
    :placeholder="placeholderComputed"
    :multiple="filterConfigCurrent.multiple"
    :clearable="!filterConfigCurrent.mandatory"
    :label="label"
    :chips="filterConfigCurrent.multiple"
    :loading="loading"
    hide-details
    return-object
    autocomplete="off"
    :no-data-text="noDataText"
    @update:search="onSearchUpdate"
    @update:model-value="onSelectedUpdate"
    @blur="onBlur"
    @focus="onFocus"
    @mouseenter="onMouseEnter"
    @click:clear="onClickClear"
  >
    <template
      v-if="loading"
      #no-data
    >
      <VListItem :title="t('$vuetify.loading')" />
    </template>
    <template #item="{ props: itemProps, internalItem }">
      <VListItem
        v-bind="itemProps"
        :title="internalItem.raw.title"
        :subtitle="internalItem.raw.subtitle"
      />
    </template>
    <template #chip="{ props: chipProps, internalItem }">
      <VChip
        :closable="chipProps.closable as boolean"
        close-label="common.button.remove"
        size="small"
        :text="`${internalItem.title} (${internalItem.raw.subtitle})`"
        :disabled="internalItem.props.disabled"
        @click:close="onChipCloseClick(internalItem.raw)"
      >
        {{ internalItem.raw.title }}
        <span
          v-if="internalItem.raw.subtitle"
          class="font-italic pl-1"
        >
          ({{ internalItem.raw.subtitle }})
        </span>
      </VChip>
    </template>
  </VAutocomplete>
</template>
