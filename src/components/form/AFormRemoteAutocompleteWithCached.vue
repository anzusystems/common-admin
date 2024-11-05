<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, ref, toRefs, watch } from 'vue'
import type { ErrorObject } from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import type { FilterBag } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import type { DocId, IntegerId } from '@/types/common'
import { cloneDeep, isArray, isNull, isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { usePagination } from '@/composables/system/pagination'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { ValueObjectOption } from '@/types/ValueObject'

// type FetchItemsByIdsType =
//   | ((ids: IntegerId[]) => Promise<ValueObjectOption<IntegerId>[]>)
//   | ((ids: DocId[]) => Promise<ValueObjectOption<DocId>[]>)

type FetchItemsMinimalType = (pagination: Pagination, filterBag: FilterBag) => Promise<any[]>

type UseCachedType = () => {
  fetch: any
  add: any
  addManualMinimal: any
}

const props = withDefaults(
  defineProps<{
    modelValue: any
    label?: string | undefined
    required?: boolean
    multiple?: boolean
    clearable?: boolean
    v?: any
    errorMessage?: string
    hideLabel?: boolean
    fetchItemsMinimal: FetchItemsMinimalType
    innerFilter: FilterBag
    filterByField?: string
    filterSortBy?: string | null
    loading?: boolean
    useCached: UseCachedType
    itemTitle?: string
    itemValue?: string
    minSearchChars?: number
    minSearchText?: string
  }>(),
  {
    label: undefined,
    required: undefined,
    multiple: false,
    clearable: false,
    v: null,
    errorMessage: undefined,
    hideLabel: false,
    filterByField: 'name',
    filterSortBy: 'createdAt',
    loading: false,
    itemTitle: 'name',
    itemValue: 'id',
    minSearchChars: 1,
    minSearchText: '',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'blur', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'focus', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetch, add, addManualMinimal } = props.useCached()

const MIN_SEARCH_CHARS = 3

const noDataText = computed(() => {
  if (loadingLocal.value) {
    return '$vuetify.loading'
  }
  if (
    fetchedItemsMinimal.value.size === 0 &&
    search.value.length < MIN_SEARCH_CHARS &&
    props.minSearchText.length > 0
  ) {
    return props.minSearchText
  }
  return undefined
})

const modelValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined) {
    emit('update:modelValue', cloneDeep<DocId | IntegerId | DocId[] | IntegerId[] | null | undefined>(newValue))
  },
})

const { t } = useI18n()
const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const isFocused = ref(false)
const search = ref('')
const loadingLocal = ref(false)
const { innerFilter } = toRefs(props)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const pagination = usePagination(props.filterSortBy)

const fetchedItemsMinimal = ref<Map<IntegerId | DocId, any>>(new Map())
// const fetchedItems = ref<Map<IntegerId | DocId, string>>(new Map())

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

const onSearchUpdate = (query: string) => {
  // if (!props.multiple && !isFocused.value && query.length === 0) return // vuetify fix
  search.value = query
}

const apiSearch = async (query: string) => {
  if (query.length < MIN_SEARCH_CHARS) {
    fetchedItemsMinimal.value.clear()
    return
  }
  loadingLocal.value = true
  const filterField = innerFilter.value[props.filterByField]
  filterField.model = query
  fetchedItemsMinimal.value.clear()
  const res = await props.fetchItemsMinimal(pagination, innerFilter.value)
  res.forEach((item: any) => {
    fetchedItemsMinimal.value.set(item[props.itemValue], item)
  })
  loadingLocal.value = false
}

const allItems = computed<ValueObjectOption<DocId | IntegerId>[]>(() => {
  const final: Map<IntegerId | DocId, string> = new Map()
  const finalRaw: Map<IntegerId | DocId, any> = new Map()
  if (isArray(modelValue.value)) {
    modelValue.value.forEach((value: any) => {
      final.set(value, '')
    })
  } else if (modelValue.value) {
    final.set(modelValue.value, '')
  }
  fetchedItemsMinimal.value.forEach((value) => {
    final.set(value[props.itemValue], value[props.itemTitle])
    finalRaw.set(value[props.itemValue], cloneDeep(value))
  })
  return Array.from(final, ([key, value]) => {
    return { value: key, title: value, raw: finalRaw.get(key) }
  })
})

const tryToAddFromFetchedItems = (ids: Set<DocId | IntegerId>) => {
  return new Promise<boolean>((resolve) => {
    fetchedItemsMinimal.value.forEach((value, key) => {
      if (ids.has(key)) {
        addManualMinimal(cloneDeep(value))
      }
    })
    return resolve(true)
  })
}

const onClickClear = () => {
  apiSearch('')
  if (props.multiple) {
    modelValue.value = []
    return
  }
  modelValue.value = null
}

// const deleteWasPressedTime = ref(0)
// const onKeydownDelete = () => {
//   deleteWasPressedTime.value = Date.now()
// }

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
  // if (newValue.length === 0 && isFocused.value === true) {
  //   const now = Date.now()
  //   if (now - deleteWasPressedTime.value > 200) {
  //     search.value = oldValue
  //     return
  //   }
  // }
  if (newValue !== oldValue) {
    emit('searchChange', newValue)
  }
})

watch(
  modelValue,
  async (newValue) => {
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      return
    }
    const values = isArray(newValue) ? newValue : [newValue]
    const idsToFetch = new Set(values)
    await tryToAddFromFetchedItems(idsToFetch)

    if (idsToFetch.size > 0) {
      add(Array.from(idsToFetch) as Array<DocId & IntegerId>)
      fetch()
    }
  },
  { immediate: true }
)
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    v-model:search="search"
    chips
    :items="allItems"
    no-filter
    :multiple="multiple"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :loading="loadingLocal"
    :no-data-text="noDataText"
    @blur="onBlur"
    @focus="onFocus"
    @update:search="onSearchUpdate"
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
    <template
      v-if="!multiple"
      #selection
    />
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
    <template #item="{ props: itemProps, item: itemItem }">
      <slot
        name="item"
        :props="itemProps"
        :item="itemItem"
      >
        <VListItem :props="itemProps" />
      </slot>
    </template>
  </VAutocomplete>
</template>
