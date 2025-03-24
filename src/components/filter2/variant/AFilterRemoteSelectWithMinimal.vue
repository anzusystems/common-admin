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
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { type FilterConfig, type FilterData, useFilterHelpers } from '@/composables/filter/filterFactory.ts'
import { isOneOf } from '@/utils/enum.ts'

type FetchItemsMinimalByIdsType = ((ids: IntegerId[]) => Promise<any[]>) | ((ids: DocId[]) => Promise<any[]>)

type FetchItemsMinimalType = (
  pagination: Pagination,
  filterData: FilterData,
  filterConfig: FilterConfig
) => Promise<any[]>

const props = withDefaults(
  defineProps<{
    name: string
    fetchItemsMinimal: FetchItemsMinimalType
    fetchItemsMinimalByIds: FetchItemsMinimalByIdsType
    filterByField: string
    filterSortBy?: string | null
    prefetch?: 'hover' | 'focus' | 'mounted'
    placeholder?: string | undefined
    itemTitle?: string
    itemValue?: string
  }>(),
  {
    filterSortBy: null,
    prefetch: 'hover',
    placeholder: undefined,
    itemTitle: 'name',
    itemValue: 'id',
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const touched = inject(FilterTouchedKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const filterInnerConfig = inject(FilterInnerConfigKey)
const filterInnerData = inject(FilterInnerDataKey)

if (
  isUndefined(submitResetCounter) ||
  isUndefined(touched) ||
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
    return filterData[props.name] as ValueObjectOption<string | number> | ValueObjectOption<string | number>[] | null
  },
  set(newValue: ValueObjectOption<string | number> | ValueObjectOption<string | number>[] | null) {
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
const fetchedItems = ref<any[]>([])
const selectedItemsCache = ref<any[]>([])

const allItems = computed<ValueObjectOption<DocId | IntegerId>[]>(() => {
  const final = new Map()
  const finalRaw: Map<IntegerId | DocId, any> = new Map()
  selectedItemsCache.value.forEach((value) => {
    if (value.raw) {
      final.set(value.raw[props.itemValue], value.raw[props.itemTitle])
      finalRaw.set(value.raw[props.itemValue], cloneDeep(value.raw))
    } else {
      final.set(value[props.itemValue], value[props.itemTitle])
      finalRaw.set(value[props.itemValue], cloneDeep(value))
    }
  })
  fetchedItems.value.forEach((value) => {
    if (value.raw) {
      final.set(value.raw[props.itemValue], value.raw[props.itemTitle])
      finalRaw.set(value.raw[props.itemValue], cloneDeep(value.raw))
    } else {
      final.set(value[props.itemValue], value[props.itemTitle])
      finalRaw.set(value[props.itemValue], cloneDeep(value))
    }
  })
  return Array.from(final, ([key, value]) => {
    return { value: key, title: value, raw: finalRaw.get(key) }
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

const tryToLoadFromLocalData = async (
  value: ValueObjectOption<string | number> | ValueObjectOption<string | number>[]
) => {
  let count = 1
  let foundItems = []
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
  const res = await props.fetchItemsMinimal(pagination, filterInnerData, filterInnerConfig)
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
  fetchedItems.value = await props.fetchItemsMinimal(pagination, filterInnerData, filterInnerConfig)
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
}

const updateSelected = () => {
  if ((isArray(modelValue.value) && modelValue.value.length === 0) || isNull(modelValue.value)) return
  if (isArray(modelValue.value)) {
    filterSelected.value.set(
      props.name,
      modelValue.value.map((item) => ({ title: item.title, value: item.value }))
    )
    return
  }
  filterSelected.value.set(props.name, [{ title: modelValue.value.title, value: modelValue.value.value }])
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
      selectedItemsCache.value = await props.fetchItemsMinimalByIds(newValue as Array<IntegerId & DocId>)
      loading.value = false
      return
    }
    loading.value = true
    selectedItemsCache.value = await props.fetchItemsMinimalByIds([newValue as DocId & IntegerId])
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
