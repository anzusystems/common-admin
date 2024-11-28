<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, ref, toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Filter, FilterBag } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import type { DocId, IntegerId } from '@/types/common'
import { cloneDeep, isArray, isNull, isUndefined } from '@/utils/common'
import { usePagination } from '@/composables/system/pagination'
import type { ValueObjectOption } from '@/types/ValueObject'

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
    itemTitle?: string
    itemValue?: string
    placeholder?: string | undefined
  }>(),
  {
    filterByField: 'name',
    filterSortBy: 'createdAt',
    itemTitle: 'name',
    itemValue: 'id',
    placeholder: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: Filter): void
  (e: 'blur', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'focus', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
}>()

const search = defineModel<string>('search', { default: '', required: false })
const loadingLocal = defineModel<boolean>('loadingLocal', { default: false, required: false })
// const fetchedItemsMinimal = defineModel<Map<IntegerId | DocId, any>>('fetchedItemsMinimal', {
//   default: new Map(),
//   required: false,
// }) // todo check why its not working

const fetchedItemsMinimal = ref<Map<IntegerId | DocId, any>>(new Map())

const MIN_SEARCH_CHARS = 2

const modelValueComputed = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue: DocId | IntegerId | DocId[] | IntegerId[] | null) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: cloneDeep(newValue) } })
  },
})

const selectedItemsCache = ref<any[]>([])
const { t } = useI18n()

const isFocused = ref(false)
const { innerFilter } = toRefs(props)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const pagination = usePagination(props.filterSortBy)

const onFocus = () => {
  isFocused.value = true
  emit('focus', modelValueComputed.value)
}

const onBlur = () => {
  isFocused.value = false
  emit('blur', modelValueComputed.value)
}

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})

const apiSearch = async (query: string | null) => {
  if (isNull(query) || query.length < MIN_SEARCH_CHARS) {
    fetchedItemsMinimal.value.clear()
    return
  }
  loadingLocal.value = true
  const filterField = innerFilter.value[props.filterByField]
  filterField.model = query
  fetchedItemsMinimal.value.clear()
  const res = await props.fetchItemsMinimal(pagination, innerFilter.value)
  res.forEach((item: any) => {
    fetchedItemsMinimal.value.set(item[props.itemValue], cloneDeep(item))
  })
  fetchedItemsMinimal.value = fetchedItemsMinimal.value
  loadingLocal.value = false
}

const allItems = computed<ValueObjectOption<DocId | IntegerId>[]>(() => {
  const final: Map<IntegerId | DocId, string> = new Map()
  const finalRaw: Map<IntegerId | DocId, any> = new Map()
  selectedItemsCache.value.forEach((value) => {
    final.set(value[props.itemValue], value[props.itemTitle])
    finalRaw.set(value[props.itemValue], cloneDeep(value))
  })
  fetchedItemsMinimal.value.forEach((value) => {
    final.set(value[props.itemValue], value[props.itemTitle])
    finalRaw.set(value[props.itemValue], cloneDeep(value))
  })
  return Array.from(final, ([key, value]) => {
    return { value: key, title: value, raw: finalRaw.get(key) }
  })
})

const onClickClear = () => {
  search.value = ''
  apiSearch('')
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

const multipleComputedVuetifyTypeFix = computed(() => {
  if (props.modelValue.multiple === false) return false
  return true as unknown as undefined
})

watchDebounced(
  search,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      apiSearch(newValue)
      emit('searchChangeDebounced', newValue)
    }
  },
  { debounce: 300 }
)

watch(search, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    emit('searchChange', newValue)
  }
})

watch(
  modelValueComputed,
  async (newValue) => {
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      return
    }
    const values = isArray(newValue) ? newValue : [newValue]
    const idsToFetch = new Set(values)
    selectedItemsCache.value = []
    if (idsToFetch.size > 0) {
      selectedItemsCache.value = await props.fetchItemsMinimalByIds(Array.from(idsToFetch) as Array<DocId & IntegerId>)
    }
  },
  { immediate: true }
)
</script>

<template>
  <VAutocomplete
    v-model="modelValueComputed"
    v-model:search="search"
    :items="allItems"
    no-filter
    :placeholder="placeholderComputed"
    :multiple="multipleComputedVuetifyTypeFix"
    :clearable="!modelValue.mandatory"
    :label="label"
    :chips="modelValue.multiple"
    :loading="loadingLocal"
    @blur="onBlur"
    @focus="onFocus"
    @click:clear="onClickClear"
  >
    <template #append-item>
      <slot name="append-item" />
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
    <!-- @vue-skip -->
    <template #item="{ props: itemProps, item }">
      <slot
        name="item"
        :item="item"
        :props="itemProps"
      />
    </template>
  </VAutocomplete>
</template>
