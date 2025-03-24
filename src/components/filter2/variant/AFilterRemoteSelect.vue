<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, type Ref, ref, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import type { Pagination } from '@/types/Pagination.ts'
import { usePagination } from '@/composables/system/pagination.ts'
import { cloneDeep, isArray, isNull, isUndefined } from '@/utils/common.ts'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common.ts'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  FilterSelectedFutureKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { type FilterConfig, type FilterData, useFilterHelpers } from '@/composables/filter/filterFactory.ts'
import { isOneOf } from '@/utils/enum.ts'

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
    placeholder?: string | undefined
    prefetch?: 'hover' | 'focus' | 'mounted'
    debug?: boolean
  }>(),
  {
    filterSortBy: null,
    placeholder: undefined,
    prefetch: 'hover',
    debug: false,
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const touched = inject(FilterTouchedKey)
const filterSelected = inject(FilterSelectedKey)
const filterSelectedFuture = inject(FilterSelectedFutureKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const filterInnerConfig = inject(FilterInnerConfigKey)
const filterInnerData = inject(FilterInnerDataKey)

if (props.debug) {
  console.log(submitResetCounter)
  console.log(touched)
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
  isUndefined(touched) ||
  isUndefined(filterSelected) ||
  isUndefined(filterSelectedFuture) ||
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
    return filterData[props.name] as ValueObjectOption<string | number> | ValueObjectOption<string | number>[] | null
  },
  set(newValue: ValueObjectOption<string | number> | ValueObjectOption<string | number>[] | null) {
    updateFilterSelectedFuture(newValue)
    let final: null | string | number | string[] | number[] = null
    if (isArray(newValue)) {
      final = newValue.map((item) => item.value) as string[] | number[]
    } else if (!isNull(newValue)) {
      final = newValue.value
    }
    filterData[props.name] = final
    touched.value = true
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

const tryToLoadFromLocalData = async (
  value: ValueObjectOption<string | number> | ValueObjectOption<string | number>[]
) => {
  let count = 1
  let foundItems: ValueObjectOption<string | number>[] = []
  if (isArray(value)) {
    count = value.length
    foundItems = findLocalDataByValues(value.map((item) => item.value))
  } else {
    foundItems = findLocalDataByValues([value.value])
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

const onMouseEnter = () => {
  if (props.prefetch === 'focus') return
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
  clearField()
}

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (filterConfigCurrent.value.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (filterConfigCurrent.value.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (filterConfigCurrent.value.variant === 'contains' || filterConfigCurrent.value.variant === 'search')
    return t('common.model.filterPlaceholder.contains')
  return ''
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
  filterSelectedFuture.value.delete(props.name)
}

const updateSelected = () => {
  filterSelected.value.delete(props.name)
  const future = filterSelectedFuture.value.get(props.name)
  if (!future || future.length === 0) return
  filterSelected.value.set(props.name, cloneDeep(future))
}

const updateFilterSelectedFuture = (
  newValue: ValueObjectOption<string | number> | ValueObjectOption<string | number>[] | null
) => {
  if ((isArray(newValue) && newValue.length === 0) || isNull(newValue)) {
    filterSelectedFuture.value.delete(props.name)
    return
  }
  if (isArray(newValue)) {
    filterSelectedFuture.value.set(
      props.name,
      newValue.map((item) => ({ title: item.title, value: item.value }))
    )
    return
  }
  filterSelectedFuture.value.set(props.name, [{ title: newValue.title, value: newValue.value }])
}

watch(submitResetCounter, () => {
  updateSelected()
})

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedItemsCache.value = []
      if (autoFetched.value === true || isOneOf(props.prefetch, ['hover', 'focus'])) return
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
    return-object
    @update:search="onSearchUpdate"
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
  </VAutocomplete>
</template>
