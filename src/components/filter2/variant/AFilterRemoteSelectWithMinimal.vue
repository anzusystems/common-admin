<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, type Ref, ref, toRefs, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import type { Pagination } from '@/types/Pagination.ts'
import type { Filter, FilterBag } from '@/types/Filter.ts'
import { usePagination } from '@/composables/system/pagination.ts'
import { cloneDeep, isArray, isNull, isUndefined } from '@/utils/common.ts'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common.ts'

type FetchItemsMinimalByIdsType = ((ids: IntegerId[]) => Promise<any[]>) | ((ids: DocId[]) => Promise<any[]>)

type FetchItemsMinimalType = (pagination: Pagination, filterBag: FilterBag) => Promise<any[]>

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    fetchItemsMinimal: FetchItemsMinimalType
    fetchItemsMinimalByIds: FetchItemsMinimalByIdsType
    innerFilter: FilterBag
    filterByField?: string
    filterSortBy?: string | null
    disableInitFetch?: boolean | undefined
    placeholder?: string | undefined
    itemTitle?: string
    itemValue?: string
  }>(),
  {
    filterByField: 'name',
    filterSortBy: 'createdAt',
    disableInitFetch: false,
    placeholder: undefined,
    itemTitle: 'name',
    itemValue: 'id',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: Filter): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue: DocId | IntegerId | DocId[] | IntegerId[] | null) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: cloneDeep(newValue) } })
  },
})

const search = ref('')
const isFocused = ref(false)
const autoFetchTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)

const apiRequestCounter = ref(0)

const { t } = useI18n()

const { innerFilter } = toRefs(props)

const onBlur = () => {
  isFocused.value = true
}

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})

const multipleComputedVuetifyTypeFix = computed(() => {
  if (props.modelValue.multiple === false) return false
  return true as unknown as undefined
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
  const filterField = innerFilter.value[props.filterByField]
  filterField.model = query
  const res = await props.fetchItemsMinimal(pagination, innerFilter.value)
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
  const res = await props.fetchItemsMinimal(pagination, innerFilter.value)
  if (apiRequestCounter.value === 0) fetchedItems.value = res
  loading.value = false
}
const onFocus = () => {
  isFocused.value = true
  clearAutoFetchTimer()
  autoFetch()
}

const singleItemSelectedTitle = computed(() => {
  if (!props.modelValue.multiple && selectedItemsCache.value[0]) {
    return selectedItemsCache.value[0].title
  }
  return undefined
})

const onSearchUpdate = (query: string) => {
  if (!props.modelValue.multiple && !isFocused.value && query.length === 0) return // vuetify fix
  if (singleItemSelectedTitle.value === query) return
  search.value = query
}

const onClickClear = async () => {
  fetchedItems.value = await props.fetchItemsMinimal(pagination, innerFilter.value)
  if (props.modelValue.multiple) {
    modelValueComputed.value = []
    return
  }
  modelValueComputed.value = null
}

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (props.modelValue.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (props.modelValue.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (props.modelValue.variant === 'contains' || props.modelValue.variant === 'search')
    return t('common.model.filterPlaceholder.contains')
  return ''
})

watch(
  modelValueComputed,
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
    v-model="modelValueComputed"
    :items="allItems"
    no-filter
    :placeholder="placeholderComputed"
    :multiple="multipleComputedVuetifyTypeFix"
    :clearable="!modelValue.mandatory"
    :label="label"
    :chips="modelValue.multiple"
    :loading="loading"
    @update:search="onSearchUpdate"
    @blur="onBlur"
    @focus="onFocus"
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
