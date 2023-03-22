<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, ref, toRefs, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { usePagination } from '@/composables/system/pagination'
import { isArray, isNull, isUndefined, cloneDeep } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { ErrorObject } from '@vuelidate/core'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { Ref } from 'vue/dist/vue'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common'

type fetchItemsByIdsType =
  | ((ids: IntegerId[]) => Promise<ValueObjectOption<IntegerId>[]>)
  | ((ids: DocId[]) => Promise<ValueObjectOption<DocId>[]>)

const props = withDefaults(
  defineProps<{
    modelValue: any
    label?: string | undefined
    required?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    v?: any
    errorMessage?: string
    hideDetails?: boolean
    hideLabel?: boolean
    fetchItems: (pagination: Pagination, filterBag: FilterBag) => Promise<ValueObjectOption<string | number>[]>
    fetchItemsByIds: fetchItemsByIdsType
    innerFilter: FilterBag
    filterByField?: string
    disableInitFetch?: boolean | undefined
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
    loading: false,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DocId | IntegerId | DocId[] | IntegerId[] | null): void
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
  (e: 'blur', data: DocId | IntegerId | DocId[] | IntegerId[] | null): void
}>()

const modelValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue: DocId | IntegerId | DocId[] | IntegerId[] | null) {
    emit('update:modelValue', cloneDeep<DocId | IntegerId | DocId[] | IntegerId[] | null>(newValue))
  },
})

const search = ref('')
const isFocused = ref(false)
const autoFetchTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)

const { t } = useI18n({ useScope: 'global' })

const { innerFilter } = toRefs(props)

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const onBlur = () => {
  isFocused.value = true
  emit('blur', props.modelValue)
  props.v?.$touch()
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

const pagination = usePagination()
const fetchedItems = ref<ValueObjectOption<string | number>[]>([])
const selectedItemsCache = ref<ValueObjectOption<string | number>[]>([])

const allItems = computed<ValueObjectOption<DocId | IntegerId>[]>(() => {
  const final = new Map()
  selectedItemsCache.value.forEach((value) => {
    final.set(value.value, { value: value.value, title: value.title })
  })
  fetchedItems.value.forEach((value) => {
    final.set(value.value, { value: value.value, title: value.title })
  })
  return Array.from(final, ([key, value]) => {
    return { value: key, title: value.title }
  })
})

const loading = ref(false)
const loadingComputed = computed(() => {
  if (loading.value) return true
  return props.loading
})

const apiSearch = async (query: string) => {
  loading.value = true
  const filterField = innerFilter.value[props.filterByField]
  filterField.model = query
  fetchedItems.value = await props.fetchItems(pagination, innerFilter.value)
  loading.value = false
}

const findLocalDataByValues = (values: Array<DocId | IntegerId>) => {
  const found = allItems.value.filter((item: ValueObjectOption<string | number>) =>
    values.includes(item.value)
  )
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
  if (isNull(modelValue.value) || isUndefined(modelValue.value) || (isArray(modelValue.value) && modelValue.value.length === 0)) {
    loading.value = true
    fetchedItems.value = await props.fetchItems(pagination, innerFilter.value)
    loading.value = false
  }
}
const onFocus = () => {
  isFocused.value = true
  clearAutoFetchTimer()
  autoFetch()
}

const singleItemSelectedTitle = computed(() => {
  if (!props.multiple && selectedItemsCache.value[0]) {
    return selectedItemsCache.value[0].title
  }
  return undefined
})

const onSearchUpdate = (query: string) => {
  if (!props.multiple && !isFocused.value && query.length === 0) return // vuetify fix
  if (singleItemSelectedTitle.value === query) return
  search.value = query
}

const onClickClear = async () => {
  fetchedItems.value = await props.fetchItems(pagination, innerFilter.value)
  if (props.multiple) {
    modelValue.value = []
    return
  }
  modelValue.value = null
}

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
    v-model="modelValue"
    :items="allItems"
    no-filter
    :multiple="multipleComputedVuetifyTypeFix"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :chips="multiple"
    :hide-details="hideDetails"
    :loading="loadingComputed"
    @update:search="onSearchUpdate"
    @blur="onBlur"
    @focus="onFocus"
    @click:clear="onClickClear"
  >
    <template #label>
      <span
        v-if="!hideLabel"
        :key="requiredComputed + ''"
      >
        {{ labelComputed }}
        <span
          v-if="requiredComputed"
          class="required"
        />
      </span>
    </template>
  </VAutocomplete>
</template>
