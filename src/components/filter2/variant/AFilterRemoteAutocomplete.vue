<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, type Ref, ref, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import type { Pagination } from '@/types/Pagination.ts'
import { usePagination } from '@/composables/system/pagination.ts'
import { isArray, isNull, isUndefined } from '@/utils/common.ts'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common.ts'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import type { FilterConfig, FilterData } from '@/composables/filter/filterFactory.ts'

type FetchItemsByIdsType =
  | ((ids: IntegerId[]) => Promise<ValueObjectOption<IntegerId>[]>)
  | ((ids: DocId[]) => Promise<ValueObjectOption<DocId>[]>)

const props = withDefaults(
  defineProps<{
    name: string
    fetchItems: (
      pagination: Pagination,
      filterData: FilterData<any>,
      filterConfig: FilterConfig<any>
    ) => Promise<ValueObjectOption<string | number>[]>
    fetchItemsByIds: FetchItemsByIdsType
    filterByField: string
    filterSortBy?: string | null
    disableInitFetch?: boolean | undefined
    placeholder?: string | undefined
    debug?: boolean
  }>(),
  {
    filterSortBy: null,
    disableInitFetch: false,
    placeholder: undefined,
    debug: false,
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

if (props.debug) {
  console.log(submitResetCounter)
  console.log(filterSelected)
  console.log(filterConfig)
  console.log(filterConfig?.fields[props.name])
  console.log(filterData)
  console.log(filterInnerConfig)
  console.log(filterInnerConfig?.fields[props.filterByField])
  console.log(filterInnerData)
  console.log(filterInnerData?.[props.filterByField])
}

if (
  isUndefined(submitResetCounter) ||
  isUndefined(filterSelected) ||
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name]) ||
  isUndefined(filterData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.name]) ||
  isUndefined(filterInnerConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterInnerConfig.fields[props.filterByField]) ||
  isUndefined(filterInnerData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterInnerData[props.filterByField])
) {
  throw new Error('Incorrect provide/inject config.')
}

const modelValue = computed({
  get() {
    return filterData[props.name] as string | number | string[] | number[] | null
  },
  set(newValue: string | number | string[] | number[] | null) {
    filterData[props.name] = newValue
    emit('change')
  },
})

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
const pagination = usePagination(props.filterSortBy)
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
  const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
  if (requestCounter === apiRequestCounter.value) fetchedItems.value = res
  loading.value = false
}

const findLocalDataByValues = (values: Array<DocId | IntegerId>) => {
  const found = allItems.value.filter((item: ValueObjectOption<string | number>) => values.includes(item.value))
  return ([] as ValueObjectOption<string | number>[]).concat(found)
}

const tryToLoadFromLocalData = async (value: string | number | string[] | number[]) => {
  let count = 1
  let foundItems = []
  if (isArray(value)) {
    count = value.length
    foundItems = findLocalDataByValues(value)
  } else {
    foundItems = findLocalDataByValues([value])
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
  const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
  if (apiRequestCounter.value === 0) fetchedItems.value = res
  loading.value = false
}
const onFocus = () => {
  isFocused.value = true
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

const onClickClear = async () => {
  fetchedItems.value = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
  if (filterConfigCurrent.value.multiple) {
    modelValue.value = []
    return
  }
  modelValue.value = null
}

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (filterConfigCurrent.value.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (filterConfigCurrent.value.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (filterConfigCurrent.value.variant === 'contains' || filterConfigCurrent.value.variant === 'search')
    return t('common.model.filterPlaceholder.contains')
  return ''
})

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedItemsCache.value = []
      if (props.disableInitFetch || autoFetched.value === true) return
      autoFetchTimer.value = setTimeout(() => {
        autoFetch()
      }, 3000)
      return
    }
    const found = await tryToLoadFromLocalData(newValue)
    if (found) return
    if (isArray<IntegerId | DocId>(newValue)) {
      loading.value = true
      selectedItemsCache.value = await props.fetchItemsByIds(newValue as Array<IntegerId & DocId>)
      loading.value = false
      return
    }
    loading.value = true
    selectedItemsCache.value = await props.fetchItemsByIds([newValue as DocId & IntegerId])
    loading.value = false
  },
  { immediate: true }
)

watchDebounced(
  search,
  (newValue, oldValue) => {
    apiRequestCounter.value++
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
    v-model="modelValue"
    :items="allItems"
    no-filter
    :placeholder="placeholderComputed"
    :multiple="filterConfigCurrent.multiple"
    :clearable="!filterConfigCurrent.mandatory"
    :label="label"
    :chips="filterConfigCurrent.multiple"
    :loading="loading"
    hide-details
    @update:search="onSearchUpdate"
    @blur="onBlur"
    @focus="onFocus"
    @click:clear="onClickClear"
  >
    <template #item="{ props: itemProps, item }">
      <VListItem
        v-bind="itemProps"
        :title="item.raw.title"
        :subtitle="item.raw.subtitle"
      />
    </template>
  </VAutocomplete>
</template>
