<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, ref, toRefs, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { usePagination } from '@/composables/system/pagination'
import { isArray, isEmptyArray, isNull, isUndefined, cloneDeep } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { ErrorObject } from '@vuelidate/core'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { Ref } from 'vue/dist/vue'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common'

type FetchItemsByIdsType =
  | ((ids: IntegerId[]) => Promise<ValueObjectOption<IntegerId>[]>)
  | ((ids: DocId[]) => Promise<ValueObjectOption<DocId>[]>)

type FetchItemsType = (pagination: Pagination, filterBag: FilterBag) => Promise<ValueObjectOption<DocId | IntegerId>[]>

type LazyLoaderType = () => {
  allValues: Ref<ValueObjectOption<DocId | IntegerId>[]>
  hasId: (id: DocId | IntegerId) => boolean
  loadedAll: Ref<boolean>
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | string[] | number[] | null
    label?: string
    required?: boolean
    multiple?: boolean
    clearable?: boolean
    v?: any
    errorMessage?: string
    hideDetails?: boolean
    hideLabel?: boolean
    fetchItems: FetchItemsType
    fetchItemsByIds: FetchItemsByIdsType
    innerFilter: FilterBag
    filterByField?: string
    disableInitFetch?: boolean
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
    disableInitFetch: false,
    lazyLoader: undefined,
    chips: false,
    loading: false,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: string | number | string[] | number[] | null): void
  (e: 'blur', data: string | number | string[] | number[] | null): void
  (e: 'focus', data: string | number | string[] | number[] | null): void
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
}>()

const modelValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue: string | number | string[] | number[] | null) {
    emit('update:modelValue', cloneDeep<string | number | string[] | number[] | null>(newValue))
  },
})

const modelValueVuetifyTypeFix = computed({
  get() {
    return modelValue.value as any
  },
  set(newValue: any) {
    modelValue.value = newValue
  },
})

const { t } = useI18n()
const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const isFocused = ref(false)

const onFocus = () => {
  isFocused.value = true
  emit('focus', modelValue.value)
}

const onBlur = () => {
  isFocused.value = false
  props.v?.$touch()
  emit('blur', modelValue.value)
}

const errorMessageComputed = computed(() => {
  if (!isUndefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return props.v.$errors.map((item: ErrorObject) => item.$message)
  return []
})

const labelComputed = computed(() => {
  if (!isUndefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = stringSplitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const requiredComputed = computed(() => {
  if (!isUndefined(props.required)) return props.required
  return props.v?.required && props.v?.required.$params.type === 'required'
})

const multipleComputedVuetifyTypeFix = computed(() => {
  if (props.multiple === false) return false
  return true as unknown as undefined
})

const arrayConcatAndFilterDuplicates = (
  arr1: ValueObjectOption<string | number>[],
  arr2: ValueObjectOption<string | number>[]
) => {
  return [...new Map([...arr1, ...arr2].map((item) => [item.value, item])).values()]
}

const loading = ref(false)
const { innerFilter } = toRefs(props)
const pagination = usePagination()
const lazyLoadingIds = ref<Array<string | number>>([])

const fetchedItems = ref<ValueObjectOption<string | number>[]>([])
const selectedItemsCache = ref<ValueObjectOption<string | number>[]>([])
const allItems = computed<ValueObjectOption<string | number>[]>(() => {
  return arrayConcatAndFilterDuplicates(selectedItemsCache.value, fetchedItems.value)
})

const apiSearch = async (query: string) => {
  loading.value = true
  const filterField = innerFilter.value[props.filterByField]
  filterField.model = query
  fetchedItems.value = await props.fetchItems(pagination, innerFilter.value)
  loading.value = false
}

if (props.lazyLoader) {
  const { allValues, loadedAll } = props.lazyLoader()
  watch(loadedAll, (newValue) => {
    if (newValue && lazyLoadingIds.value.length > 0)
      selectedItemsCache.value = allValues.value.filter((item) => lazyLoadingIds.value.includes(item.value))
  })
}

const findLocalDataByValues = (values: Array<string | number>) => {
  const found1 = selectedItemsCache.value.filter((item: ValueObjectOption<string | number>) =>
    values.includes(item.value)
  )
  const found2 = fetchedItems.value.filter((item: ValueObjectOption<string | number>) => values.includes(item.value))
  return arrayConcatAndFilterDuplicates(found1, found2)
}

const tryToLoadFromLocalData = async (values: Array<string | number>) => {
  return new Promise<boolean>((resolve) => {
    const foundItems = findLocalDataByValues(values)
    selectedItemsCache.value = foundItems
    return resolve(foundItems.length === values.length)
  })
}

const tryToLoadFromLazyLoader = (values: Array<string | number>) => {
  return new Promise<boolean>((resolve) => {
    if (!props.lazyLoader) return resolve(false)
    const { hasId, allValues, loadedAll } = props.lazyLoader()
    const idsInLazyLoader = values.every((id) => hasId(id))
    if (!idsInLazyLoader) return resolve(false)
    if (loadedAll.value) {
      selectedItemsCache.value = cloneDeep(allValues.value.filter((item) => values.includes(item.value)))
      return resolve(true)
    }
    values.forEach((id) => lazyLoadingIds.value.push(id))
    return resolve(true)
  })
}

const fetchOnInit = async (model: string | number | string[] | number[] | null) => {
  if (!props.disableInitFetch && (isEmptyArray(model) || isNull(model))) {
    loading.value = true
    fetchedItems.value = await props.fetchItems(pagination, innerFilter.value)
    loading.value = false
  }
}

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedItemsCache.value = []
      await fetchOnInit(newValue)
      return
    }
    const values = isArray(newValue) ? newValue : [newValue]
    const foundLocalData = await tryToLoadFromLocalData(values)
    const foundLazyLoader = await tryToLoadFromLazyLoader(values)

    if (!foundLocalData && !foundLazyLoader)
      selectedItemsCache.value = await props.fetchItemsByIds(values as string[] & number[])
  },
  { immediate: true }
)

const search = ref('')

const onSearchUpdate = (query: string) => {
  if (!props.multiple && !isFocused.value && query.length === 0) return // vuetify fix
  search.value = query
}

watchDebounced(
  search,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      apiSearch(newValue)
      emit('searchChangeDebounced', newValue)
    }
  },
  { debounce: 300, maxWait: 1000 }
)

watch(search, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    emit('searchChange', newValue)
  }
})
</script>

<template>
  <VAutocomplete
    v-model="modelValueVuetifyTypeFix"
    :chips="chips"
    :items="allItems"
    item-title="title"
    item-value="value"
    no-filter
    :multiple="multipleComputedVuetifyTypeFix"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :loading="loading"
    dirty
    @blur="onBlur"
    @focus="onFocus"
    @update:search="onSearchUpdate"
  >
    <template #label>
      <span
        v-if="!hideLabel"
        :key="requiredComputed + ''"
      >
        {{ labelComputed }}<span
          v-if="requiredComputed"
          class="required"
        />
      </span>
    </template>
    <template
      v-if="chips"
      #chip="{ props: chipProps, item }"
    >
      <slot
        name="chip"
        :props="chipProps"
        :item="item"
      >
        <VChip
          v-bind="chipProps"
          :text="item.title"
        />
      </slot>
    </template>
  </VAutocomplete>
</template>
