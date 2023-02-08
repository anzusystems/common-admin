<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, ref, toRefs, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { Filter, FilterBag } from '@/types/Filter'
import { usePagination } from '@/composables/system/pagination'
import { isArray, isNull } from '@/utils/common'

type FetchItemsByIdsType =
  | ((ids: number[]) => Promise<ValueObjectOption<number>[]>)
  | ((ids: string[]) => Promise<ValueObjectOption<string>[]>)

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    fetchItems: (pagination: Pagination, filterBag: FilterBag) => Promise<ValueObjectOption<string | number>[]>
    fetchItemsByIds: FetchItemsByIdsType
    innerFilter: FilterBag
    filterByField?: string
  }>(),
  {
    filterByField: 'name',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: Filter): void
}>()

const value = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: newValue } })
  },
})

const search = ref()

const { innerFilter } = toRefs(props)

const filterDuplicates = (arr: any[]) => {
  const uniqueValues = new Map()
  for (let index = 0; index < arr.length; ++index) {
    const item = arr[index]
    if (item == null) {
      continue
    }
    !uniqueValues.has(item.value) && uniqueValues.set(item.value, item)
  }
  return Array.from(uniqueValues.values())
}

const pagination = usePagination()
const items = ref<ValueObjectOption<string | number>[]>([])
const selectedCachedItems = ref<ValueObjectOption<string | number>[]>([])
const allItems = computed(() => {
  return filterDuplicates(selectedCachedItems.value.concat(items.value))
})
const loading = ref(false)

const apiSearch = async (query: string) => {
  if (query.length > 0) {
    loading.value = true
    const filterField = innerFilter.value[props.filterByField]
    filterField.model = query
    items.value = await props.fetchItems(pagination, innerFilter.value)
    loading.value = false
  }
}

const findLocalDataByValues = (values: Array<string | number>) => {
  const found1 = selectedCachedItems.value.filter((item: ValueObjectOption<string | number>) =>
    values.includes(item.value)
  )
  const found2 = items.value.filter((item: ValueObjectOption<string | number>) => values.includes(item.value))
  return filterDuplicates(([] as ValueObjectOption<string | number>[]).concat(found1, found2))
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
  selectedCachedItems.value = foundItems
  return foundItems.length === count
}

watch(
  value,
  async (newValue) => {
    if (isNull(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedCachedItems.value = []
      return
    }
    const found = await tryToLoadFromLocalData(newValue)
    if (!found) selectedCachedItems.value = await props.fetchItemsByIds(isArray(newValue) ? newValue : [newValue])
  },
  { immediate: true }
)

watchDebounced(
  search,
  (newValue) => {
    apiSearch(newValue)
  },
  { debounce: 300, maxWait: 1000 }
)
</script>

<template>
  <VAutocomplete
    v-model="value"
    v-model:search="search"
    :items="allItems"
    item-title="title"
    item-value="value"
    no-filter
    :label="modelValue.title"
    :multiple="modelValue.multiple"
    :clearable="!modelValue.mandatory"
  />
</template>
