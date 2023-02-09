<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, onMounted, ref, toRefs, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { usePagination } from '@/composables/system/pagination'
import { isArray, isNull, isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { ErrorObject } from '@vuelidate/core'
import { splitOnFirstOccurrence } from '@/utils/string'
import type { Ref } from 'vue/dist/vue'
import { simpleCloneObject } from '@/utils/object'
import { useI18n } from '@/create'

type FetchItemsByIdsType =
  | ((ids: number[]) => Promise<ValueObjectOption<number>[]>)
  | ((ids: string[]) => Promise<ValueObjectOption<string>[]>)

type LazyLoaderType = () => {
  allValues: Ref<ValueObjectOption<string | number>[]>
  hasId: (id: string | number) => boolean
  loadedAll: Ref<boolean>
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue: any // any is temp fix for vuetify
    label?: string
    required?: boolean
    multiple?: boolean
    clearable?: boolean
    v?: any
    errorMessage?: string
    hideDetails?: boolean
    hideLabel?: boolean
    fetchItems: (pagination: Pagination, filterBag: FilterBag) => Promise<ValueObjectOption<string | number>[]>
    fetchItemsByIds: FetchItemsByIdsType
    innerFilter: FilterBag
    filterByField?: string
    fetchFewOnInit?: boolean
    lazyLoader?: LazyLoaderType
    chips?: boolean
    loading?: boolean
  }>(),
  {
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    v: null,
    errorMessage: undefined,
    hideDetails: false,
    hideLabel: false,
    filterByField: 'name',
    fetchFewOnInit: true,
    lazyLoader: undefined,
    chips: false,
    loading: false,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'blur', data: string | number | string[] | number[] | null): void
  (e: 'searchChange', data: string): void
}>()

const value = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', simpleCloneObject<string | number | string[] | number[] | null | any>(newValue))
  },
})

const search = ref()

const { innerFilter } = toRefs(props)

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const onBlur = () => {
  props.v?.$touch()
  emit('blur', value.value)
}

const errorMessageComputed = computed(() => {
  if (!isUndefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return props.v.$errors.map((item: ErrorObject) => item.$message)
  return []
})
const { t } = useI18n()
const labelComputed = computed(() => {
  if (!isUndefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = splitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})
const requiredComputed = computed(() => {
  if (!isUndefined(props.required)) return props.required
  return props.v?.required && props.v?.required.$params.type === 'required'
})
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
const lazyLoadingIds = ref<Array<string | number>>([])

const apiSearch = async (query: string) => {
  if (query.length > 0) {
    loading.value = true
    const filterField = innerFilter.value[props.filterByField]
    filterField.model = query
    items.value = await props.fetchItems(pagination, innerFilter.value)
    loading.value = false
  }
}

if (props.lazyLoader) {
  const { allValues, loadedAll } = props.lazyLoader()
  watch(loadedAll, (newValue) => {
    if (newValue && lazyLoadingIds.value.length > 0)
      selectedCachedItems.value = allValues.value.filter((item) => lazyLoadingIds.value.includes(item.value))
  })
}

const findLocalDataByValues = (values: Array<string | number>) => {
  const found1 = selectedCachedItems.value.filter((item: ValueObjectOption<string | number>) =>
    values.includes(item.value)
  )
  const found2 = items.value.filter((item: ValueObjectOption<string | number>) => values.includes(item.value))
  return filterDuplicates(([] as ValueObjectOption<string | number>[]).concat(found1, found2))
}

const tryToLoadFromLocalData = async (values: Array<string | number>) => {
  const count = values.length
  const foundItems = findLocalDataByValues(values)
  selectedCachedItems.value = foundItems
  return foundItems.length === count
}

const tryToLoadFromLazyLoader = (values: Array<string | number>) => {
  if (!props.lazyLoader) return false
  const { hasId, allValues, loadedAll } = props.lazyLoader()
  const idsInLazyLoader = values.every((id) => hasId(id))
  if (!idsInLazyLoader) return false
  if (loadedAll.value) selectedCachedItems.value = allValues.value.filter((item) => values.includes(item.value))
  else values.forEach((id) => lazyLoadingIds.value.push(id))
  return true
}

watch(
  value,
  async (newValue) => {
    if (isNull(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedCachedItems.value = []
      return
    }
    const values = isArray(newValue) ? newValue : [newValue]
    const foundLocalData = await tryToLoadFromLocalData(values)
    const foundLazyLoader = tryToLoadFromLazyLoader(values)

    if (!foundLocalData && !foundLazyLoader) selectedCachedItems.value = await props.fetchItemsByIds(values)
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

watch(search, (newValue) => {
  emit('searchChange', newValue)
})

onMounted(async () => {
  if (props.fetchFewOnInit && items.value.length === 0) {
    loading.value = true
    items.value = await props.fetchItems(pagination, innerFilter.value)
    loading.value = false
  }
})
</script>

<template>
  <VAutocomplete
    v-model="value"
    v-model:search="search"
    :chips="chips"
    :items="allItems"
    item-title="title"
    item-value="value"
    no-filter
    :multiple="multiple"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :loading="loading"
    dirty
    @blur="onBlur"
  >
    <template #label>
      <span v-if="!hideLabel" :key="requiredComputed + ''"
        >{{ labelComputed }}<span v-if="requiredComputed" class="required" />
      </span>
    </template>
    <template v-if="chips" #chip="{ props: chipProps, item }">
      <slot name="chip" :props="chipProps" :item="item">
        <VChip v-bind="chipProps" :text="item.title" />
      </slot>
    </template>
  </VAutocomplete>
</template>
