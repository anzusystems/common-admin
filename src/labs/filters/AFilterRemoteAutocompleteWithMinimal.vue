<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, getCurrentInstance, inject, type Ref, ref, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isArray, isBoolean, isNull, isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import { type FilterConfig, type FilterData, useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { isOneOf } from '@/utils/enum'
import type { DatatableSortBy } from '@/composables/system/datatableColumns'

import { type Pagination, usePagination } from '@/labs/filters/pagination'

type FetchItemsMinimalByIdsType = ((ids: IntegerId[]) => Promise<any[]>) | ((ids: DocId[]) => Promise<any[]>)

type FetchItemsMinimalType = (
  pagination: Ref<Pagination>,
  filterData: FilterData,
  filterConfig: FilterConfig
) => Promise<any[]>

const props = withDefaults(
  defineProps<{
    name: string
    fetchItemsMinimal: FetchItemsMinimalType
    fetchItemsMinimalByIds: FetchItemsMinimalByIdsType
    filterByField: string
    filterSortBy?: DatatableSortBy
    placeholder?: string | undefined
    prefetch?: 'hover' | 'focus' | 'mounted' | false
    searchMinChars?: number
    itemTitle?: string
    itemValue?: string
  }>(),
  {
    filterSortBy: null,
    placeholder: undefined,
    prefetch: false,
    searchMinChars: 2,
    itemTitle: 'name',
    itemValue: 'id',
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

if (
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.name])
) {
  throw new Error(
    `[${componentName}] Incorrect filter config. ` +
      `Name is '${props.name}' and available options are ${Object.keys(filterData).join(', ')}.`
  )
}

if (
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterInnerConfig.fields[props.filterByField]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterInnerData[props.filterByField])
) {
  throw new Error(
    `[${componentName}] Incorrect filter inner config. ` +
      `FilterByField is '${props.filterByField}' and available options are ${Object.keys(filterInnerData).join(', ')}.`
  )
}

const selected = ref<any>([])
const search = ref('')
const isFocused = ref(false)
const autoFetchTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)

const apiRequestCounter = ref(0)

const { t } = useI18n()

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const onBlur = () => {
  isFocused.value = true
}

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { pagination } = usePagination({ sortBy: props.filterSortBy })
const fetchedItems = ref<ValueObjectOption<string | number>[]>([])
const selectedItemsCache = ref<ValueObjectOption<string | number>[]>([])

const allItems = computed<ValueObjectOption<DocId | IntegerId>[]>(() => {
  const final = new Map()
  selectedItemsCache.value.forEach((value) => {
    final.set(value.value, { value: value.value, title: value.title, subtitle: value.subtitle })
  })
  fetchedItems.value.forEach((value) => {
    final.set(value.value, { value: value.value, title: value.title, subtitle: value.subtitle })
  })
  return Array.from(final, ([key, value]) => {
    return { value: key, title: value.title, subtitle: value.subtitle }
  })
})

const loading = ref(false)

const apiSearch = async (query: string, requestCounter: number) => {
  loading.value = true
  filterInnerData[props.filterByField] = query
  const res = await props.fetchItemsMinimal(pagination, filterInnerData, filterInnerConfig)
  if (requestCounter === apiRequestCounter.value) fetchedItems.value = res
  loading.value = false
}

const findLocalDataByValues = (values: Array<DocId | IntegerId>) => {
  const found = allItems.value.filter((item: ValueObjectOption<string | number>) => values.includes(item.value))
  return ([] as ValueObjectOption<string | number>[]).concat(found)
}

const tryToLoadFromLocalData = async (newValue: string | number | Array<string | number>) => {
  let count = 1
  let foundItems: ValueObjectOption<string | number>[] = []
  if (isArray(newValue)) {
    count = newValue.length
    foundItems = findLocalDataByValues(newValue)
  } else {
    foundItems = findLocalDataByValues([newValue])
  }
  selectedItemsCache.value = foundItems
  return foundItems.length === count
}

const autoFetched = ref(false)

const clearAutoFetchTimer = () => {
  clearTimeout(autoFetchTimer.value)
  autoFetchTimer.value = undefined
}

const autoFetch = async () => {
  clearAutoFetchTimer()
  if (autoFetched.value === true) return
  autoFetched.value = true
  loading.value = true
  const res = await props.fetchItemsMinimal(pagination, filterInnerData, filterInnerConfig)
  if (apiRequestCounter.value === 0) fetchedItems.value = res
  loading.value = false
}

const onFocus = () => {
  isFocused.value = true
  if (props.prefetch === false) return
  clearAutoFetchTimer()
  autoFetch()
}

const onMouseEnter = () => {
  if (props.prefetch === 'focus' || props.prefetch === false) return
  clearAutoFetchTimer()
  autoFetch()
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

const onClickClear = async () => {
  fetchedItems.value = await props.fetchItemsMinimal(pagination, filterInnerData, filterInnerConfig)
  clearField()
}

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (filterConfigCurrent.value.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (filterConfigCurrent.value.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (filterConfigCurrent.value.variant === 'search') return t('common.model.filterPlaceholder.contains')
  return ''
})

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
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
  async (newValue, oldValue) => {
    if (newValue === oldValue || isBoolean(newValue)) return
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedItemsCache.value = []
      if (filterConfigCurrent.value.multiple) {
        selected.value = []
      } else {
        selected.value = null
      }
      updateFilterSelected(selected.value)
      if (autoFetched.value === true || isOneOf(props.prefetch, ['hover', 'focus'])) return
      autoFetchTimer.value = setTimeout(() => {
        autoFetch()
      }, 3000)
      return
    }
    const found = await tryToLoadFromLocalData(newValue)
    if (found) {
      selected.value = selectedItemsCache.value.map((item) => ({ title: item.title, value: item.value }))
      updateFilterSelected(selected.value)
      return
    }
    if (isArray(newValue)) {
      loading.value = true
      selectedItemsCache.value = await props.fetchItemsMinimalByIds(newValue as Array<IntegerId & DocId>)
      selected.value = selectedItemsCache.value.map((item) => ({ title: item.title, value: item.value }))
      updateFilterSelected(selected.value)
      loading.value = false
      return
    }
    loading.value = true
    selectedItemsCache.value = await props.fetchItemsMinimalByIds([newValue as DocId & IntegerId])
    selected.value = selectedItemsCache.value.map((item) => ({ title: item.title, value: item.value }))[0]
    updateFilterSelected(selected.value)
    loading.value = false
  },
  { immediate: true }
)

watchDebounced(
  search,
  (newValue, oldValue) => {
    if (newValue.length < props.searchMinChars) return
    if (newValue !== oldValue) {
      apiRequestCounter.value++
      apiSearch(newValue, apiRequestCounter.value)
    }
  },
  { debounce: 300 }
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
    @update:search="onSearchUpdate"
    @update:model-value="onSelectedUpdate"
    @blur="onBlur"
    @focus="onFocus"
    @mouseenter="onMouseEnter"
    @click:clear="onClickClear"
  >
    <!-- @vue-skip -->
    <template #item="{ props: itemProps, item: itemItem }">
      <slot
        name="item"
        :item="itemItem"
        :props="itemProps"
      >
        <VListItem
          v-bind="itemProps"
          :title="itemItem.raw.title"
          :subtitle="itemItem.raw.subtitle"
        />
      </slot>
    </template>
    <!-- @vue-skip -->
    <template #chip="{ props: chipProps, item: chipItem }">
      <slot
        name="chip"
        :props="chipProps"
        :item="chipItem"
      >
        <VChip
          v-bind="chipProps"
          :text="chipItem.title"
        />
      </slot>
    </template>
  </VAutocomplete>
</template>
