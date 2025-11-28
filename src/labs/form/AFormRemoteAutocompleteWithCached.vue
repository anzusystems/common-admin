<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, getCurrentInstance, inject, type Ref, ref, watch } from 'vue'
import type { ErrorObject } from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import type { Pagination } from '@/labs/filters/pagination'
import { usePagination } from '@/labs/filters/pagination'
import type { DocId, IntegerId } from '@/types/common'
import { cloneDeep, isArray, isNull, isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'
import type { DatatableSortBy } from '@/composables/system/datatableColumns'

type FetchItemsMinimalType = (
  pagination: Ref<Pagination>,
  filterData: FilterData,
  filterConfig: FilterConfig
) => Promise<any[]>

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
    filterByField?: string
    filterSortBy?: DatatableSortBy
    loading?: boolean
    useCached: UseCachedType
    itemTitle?: string
    itemValue?: string
    minSearchChars?: number
    minSearchText?: string | undefined
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
    filterSortBy: null,
    loading: false,
    itemTitle: 'name',
    itemValue: 'id',
    minSearchChars: 2,
    minSearchText: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'blur', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'focus', data: DocId | IntegerId | DocId[] | IntegerId[] | null | undefined): void
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
}>()

const search = defineModel<string>('search', { default: '', required: false })
const loadingLocal = defineModel<boolean>('loadingLocal', { default: false, required: false })
const fetchedItemsMinimal = defineModel<Map<IntegerId | DocId, any>>('fetchedItemsMinimal', {
  required: true,
})

const filterInnerConfig = inject(FilterInnerConfigKey)
const filterInnerData = inject(FilterInnerDataKey)

const componentName = getCurrentInstance()?.type.__name

if (isUndefined(filterInnerConfig) || isUndefined(filterInnerData)) {
  throw new Error(`[${componentName}] Incorrect provide/inject config.`)
}

if (
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterInnerConfig.fields[props.filterByField]) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterInnerData[props.filterByField])
) {
  throw new Error(
    `[${componentName}] Incorrect filter inner config. ` +
      `FilterByField is '${props.filterByField}' and available options are ${Object.keys(filterInnerData).join(', ')}.`
  )
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetch, add, addManualMinimal } = props.useCached()

const noDataText = computed(() => {
  if (loadingLocal.value) {
    return '$vuetify.loading'
  }
  if (fetchedItemsMinimal.value.size === 0 && search.value.length < props.minSearchChars) {
    return isUndefined(props.minSearchText)
      ? t('common.filter.filterMinChars', { min: props.minSearchChars })
      : props.minSearchText
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
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { pagination } = usePagination(
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isNull(props.filterSortBy) ? null : props.filterSortBy.key,
  props.filterSortBy?.order
)

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

const apiSearch = async (query: string | null) => {
  if (isNull(query) || query.length < props.minSearchChars) {
    fetchedItemsMinimal.value.clear()
    return
  }
  loadingLocal.value = true
  filterInnerData[props.filterByField] = query
  fetchedItemsMinimal.value.clear()
  const res = await props.fetchItemsMinimal(pagination, filterInnerData, filterInnerConfig)
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
  search.value = ''
  apiSearch('')
  if (props.multiple) {
    modelValue.value = []
    return
  }
  modelValue.value = null
}

watchDebounced(
  search,
  (newValueBug, oldValueBug) => { // todo rollback fix when fixed on vuetify/vue use side
    const newValue = newValueBug as unknown as string
    const oldValue = oldValueBug as unknown as string | undefined
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
    autocomplete="off"
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
    <template #append-item>
      <slot name="append-item" />
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
