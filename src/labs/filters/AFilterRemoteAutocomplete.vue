<script lang="ts" setup generic="T extends string | number">
import { watchDebounced } from '@vueuse/core'
import { computed, getCurrentInstance, inject, type Ref, ref, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isArray, isBoolean, isEmpty, isNull, isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { type FilterConfig, type FilterData, useFilterClearHelpers } from '@/labs/filters/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { DatatableSortBy } from '@/composables/system/datatableColumns'
import { type Pagination, usePagination } from '@/labs/filters/pagination'
import { useAlerts } from '@/composables/system/alerts'

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

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

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

const loading = ref(false)

const resetToEmptyState = (value: ModelValueType) => {
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
  loading.value = true

  try {
    const idsArray = isArray(ids) ? ids : [ids]
    selectedItemsCache.value = await props.fetchItemsByIds(idsArray)
    const selectedNewValue = updateSelected(ids)
    selected.value = selectedNewValue
    modelValueAutocomplete.value = selectedNewValue
    updateFilterSelected(selected.value)
    return selectedItemsCache.value
  } finally {
    loading.value = false
  }
}

const { showErrorsDefault } = useAlerts()

const apiSearch = async (query: string, requestCounter: number) => {
  loading.value = true
  filterInnerData[filterByFieldProp] = query
  try {
    const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
    if (requestCounter === apiRequestCounter.value) fetchedItems.value = res
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    loading.value = false
  }
}

const tryAutoFetch = async (mode: 'focus' | 'hover' | 'mounted') => {
  if (props.prefetch === false || props.prefetch !== mode) return
  if (loading.value) return
  if (prefetchCompleted.value) return

  loading.value = true
  try {
    const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
    if (apiRequestCounter.value === 0) {
      fetchedItems.value = res
    }
    prefetchCompleted.value = true
  } finally {
    loading.value = false
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

const onSearchUpdate = (query: string) => {
  if (!filterConfigCurrent.value.multiple && !isFocused.value && query.length === 0) return // vuetify fix
  if (singleItemSelectedTitle.value === query) return
  search.value = query
}

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const onClickClear = async () => {
  fetchedItems.value = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
  clearField()
}

watchDebounced(
  search,
  (newValue, oldValue) => {
    if (newValue.length < props.minSearchChars) return
    if (newValue !== oldValue) {
      apiRequestCounter.value++
      apiSearch(newValue, apiRequestCounter.value)
    }
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
    if (newValueFilterData === oldValueFilterData || isBoolean(newValueFilterData)) return
    const newValue = newValueFilterData as ModelValueType
    if (isFirstLoad.value) {
      isFirstLoad.value = false
      await checkFirstLoad()
    }
    if (isEmpty(newValue)) {
      resetToEmptyState(newValue)
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
    <template #item="{ props: itemProps, item }">
      <VListItem
        v-bind="itemProps"
        :title="item.raw.title"
        :subtitle="item.raw.subtitle"
      />
    </template>
    <template #chip="{ props: chipProps, item }">
      <VChip
        :closable="chipProps.closable as boolean"
        size="small"
        :text="`${item.title} (${item.raw.subtitle})`"
        :disabled="item.props.disabled"
      >
        {{ item.raw.title }}
        <span
          v-if="item.raw.subtitle"
          class="font-italic pl-1"
        >
          ({{ item.raw.subtitle }})
        </span>
      </VChip>
    </template>
  </VAutocomplete>
</template>
