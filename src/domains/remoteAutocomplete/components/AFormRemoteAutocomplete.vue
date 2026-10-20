<script lang="ts" setup generic="T extends string | number">
import type { AFormFieldValidation } from '@/shared/types/Validation'
import { watchDebounced } from '@vueuse/core'
import { computed, getCurrentInstance, inject, type Ref, ref, watch, unref } from 'vue'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { cloneDeep, isArray, isDefined, isEmpty, isNull, isUndefined } from '@/shared/utils/common'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'
import { stringSplitOnFirstOccurrence } from '@/shared/utils/string'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId, IntegerIdNullable } from '@/shared/types/common'
import ACollabLockedByUser from '@/domains/collab/components/ACollabLockedByUser.vue'
import type { CollabComponentConfig, CollabFieldData } from '@/domains/collab/types/Collab'
import { useCollabField } from '@/domains/collab/composables/collabField'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import type { DatatableSortBy } from '@/domains/filters/datatable/utils/datatableColumns'
import { type Pagination, usePagination } from '@/domains/api/composables/pagination'
import { useAlerts } from '@/domains/system/composables/alerts'

type ModelValueType = T | T[] | null | undefined

const props = withDefaults(
  defineProps<{
    label?: string | undefined
    required?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    v?: AFormFieldValidation | null
    errorMessage?: string
    hideDetails?: boolean
    hideLabel?: boolean
    fetchItems: (
      pagination: Ref<Pagination>,
      filterData: FilterData,
      filterConfig: FilterConfig
    ) => Promise<ValueObjectOption<T>[]>
    fetchItemsByIds: (ids: T[]) => Promise<ValueObjectOption<T>[]>
    filterByField: string
    filterSortBy?: DatatableSortBy
    loading?: boolean
    collab?: CollabComponentConfig
    disabled?: boolean | undefined
    readonly?: boolean
    chips?: boolean
    closableChips?: boolean
    disableAutoSingleSelect?: boolean // auto select works only when modelValue is empty/null and prefetch is set to 'mounted'
    prefetch?: 'hover' | 'focus' | 'mounted' | false
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
    hideDetails: false,
    hideLabel: false,
    filterSortBy: null,
    loading: false,
    collab: undefined,
    disabled: undefined,
    chips: false,
    closableChips: false,
    disableAutoSingleSelect: false,
    prefetch: false,
    minSearchChars: 2,
    minSearchText: undefined,
  }
)
const emit = defineEmits<{
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
  (e: 'blur', data: ModelValueType): void
  (e: 'focus', data: ModelValueType): void
  (e: 'click:chipClose', data: ValueObjectOption<T>): void
}>()

const SEARCH_DEBOUNCE_MS = 300

const filterInnerConfig = inject(FilterInnerConfigKey)
const filterInnerData = inject(FilterInnerDataKey)

const componentName = getCurrentInstance()?.type.__name

if (isUndefined(filterInnerConfig) || isUndefined(filterInnerData)) {
  throw new Error(`[${componentName}] Incorrect provide/inject config.`)
}
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const filterByFieldProp = props.filterByField
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const filterSortByProp = props.filterSortBy

if (isUndefined(filterInnerConfig.fields[filterByFieldProp]) || isUndefined(filterInnerData[filterByFieldProp])) {
  throw new Error(
    `[${componentName}] Incorrect filter inner config. ` +
      `FilterByField is '${filterByFieldProp}' and available options are ${Object.keys(filterInnerData).join(', ')}.`
  )
}

const modelValue = defineModel<ModelValueType>({
  required: true,
  set(newValue) {
    return isArray(newValue) ? cloneDeep(newValue) : newValue
  },
})

const modelValueSelected = defineModel<ValueObjectOption<T> | ValueObjectOption<T>[] | null>('selected', {
  required: false,
  default: null,
  set(newValue) {
    return isArray(newValue) ? cloneDeep(newValue) : newValue
  },
})

// Collaboration
const { collabOptions } = useCommonAdminCollabOptions()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseFieldLock = ref((data: CollabFieldData) => {})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const changeFieldData = ref((data: CollabFieldData) => {})
const acquireFieldLock = ref(() => {})
const lockedByUserLocal = ref<IntegerIdNullable>(null)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (collabOptions.value.enabled && isDefined(props.collab)) {
  const { releaseCollabFieldLock, changeCollabFieldData, acquireCollabFieldLock, lockedByUser } = useCollabField(
    props.collab.room,
    props.collab.field,
    false,
    true
  )
  releaseFieldLock.value = releaseCollabFieldLock
  changeFieldData.value = changeCollabFieldData
  acquireFieldLock.value = acquireCollabFieldLock
  watch(
    lockedByUser,
    (newValue) => {
      lockedByUserLocal.value = newValue
    },
    { immediate: true }
  )
}

const search = ref('')
const isFocused = ref(false)
const modelValueAutocomplete = ref<ValueObjectOption<T> | ValueObjectOption<T>[] | null>(null)
const apiRequestCounter = ref(0)

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeKey, undefined)
const subject = inject<string | undefined>(SubjectScopeKey, undefined)

const onBlur = () => {
  isFocused.value = false
  emit('blur', modelValue.value)
  props.v?.$touch()
  releaseFieldLock.value(modelValue.value)
}

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return props.v.$errors.map((item) => unref(item.$message))
  return []
})

const labelComputed = computed(() => {
  if (isDefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = stringSplitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const requiredComputed = computed(() => {
  if (isDefined(props.required)) return props.required
  return (props.v?.required as { $params?: { type?: string } } | undefined)?.$params?.type === 'required'
})

const disabledComputed = computed(() => {
  if (isDefined(props.disabled)) return props.disabled
  return !!lockedByUserLocal.value
})

const { pagination } = usePagination(isNull(filterSortByProp) ? null : filterSortByProp.key, filterSortByProp?.order)
const fetchedItems = ref<ValueObjectOption<T>[]>([])
const selectedItemsCache = ref<ValueObjectOption<T>[]>([])
const isFirstLoad = ref(true)
const prefetchCompleted = ref(false)

const allItems = computed<ValueObjectOption<T>[]>(() => {
  const itemsMap = new Map<T, ValueObjectOption<T>>()
  const addToMap = (items: ValueObjectOption<T>[]) => {
    items.forEach((item) => {
      itemsMap.set(item.value, {
        value: item.value,
        title: item.title,
        subtitle: item.subtitle,
      } as ValueObjectOption<T>)
    })
  }

  addToMap(selectedItemsCache.value as ValueObjectOption<T>[])
  addToMap(fetchedItems.value as ValueObjectOption<T>[])

  return Array.from(itemsMap.values())
})

// The requests of the component on their way (items by their ids, a search, a prefetch): its spinner is on while
// any of them runs, and goes off with the last. Each turned it off as it ended: a read by ids hid the spinner of a
// search still running, and the reverse.
const requestsRunning = ref(0)
const loadingLocal = computed(() => requestsRunning.value > 0)
const loadingComputed = computed(() => {
  if (loadingLocal.value) return true
  return props.loading
})

const resetToEmptyState = (value: ModelValueType) => {
  byIdsCounter++
  selectedItemsCache.value = []
  modelValueSelected.value = isArray(value) ? [] : null
  modelValueAutocomplete.value = isArray(value) ? [] : null
}

const updateSelected = (value: T[] | T) => {
  const findItem = (id: T): ValueObjectOption<T> =>
    allItems.value.find((obj) => obj.value === id) ?? ({ title: `${id}`, value: id } as ValueObjectOption<T>)
  return isArray(value) ? value.map(findItem) : findItem(value)
}

let byIdsCounter = 0
const loadListItems = async (ids: T[] | T) => {
  const requestId = ++byIdsCounter
  requestsRunning.value++

  try {
    const idsArray = isArray(ids) ? ids : [ids]
    const res = await props.fetchItemsByIds(idsArray)
    if (requestId !== byIdsCounter) return selectedItemsCache.value
    selectedItemsCache.value = res
    const selectedNewValue = updateSelected(ids)
    modelValueSelected.value = selectedNewValue
    modelValueAutocomplete.value = selectedNewValue
    return selectedItemsCache.value
  } catch (e) {
    // Mirror tryLoadModelValue: don't let a failed by-ids resolve become a generic global toast (QA 85050).
    showErrorsDefault(e)
    return undefined
  } finally {
    requestsRunning.value--
  }
}

const tryLoadModelValue = async (tryLoadValue: ModelValueType, prefetch = false) => {
  const idsToFetch = isArray(tryLoadValue) ? tryLoadValue : [tryLoadValue]
  let fetchedData: ValueObjectOption<T>[]
  requestsRunning.value++
  try {
    fetchedData = await props.fetchItemsByIds(idsToFetch as Array<IntegerId & DocId>)
  } catch (e) {
    showErrorsDefault(e)
    return false
  } finally {
    // Over before the prefetch below, which bails out while a request of the component runs.
    requestsRunning.value--
  }
  if (!isArray(fetchedData) || fetchedData.length === 0) return false
  selectedItemsCache.value = fetchedData
  const value = props.multiple ? fetchedData.map((item) => item.value) : fetchedData[0]!.value
  modelValue.value = value
  if (prefetch) await tryAutoFetch('force', value)
  return true
}

const { showErrorsDefault } = useAlerts()

const apiSearch = async (query: string, requestCounter: number) => {
  requestsRunning.value++
  filterInnerData[filterByFieldProp] = query
  try {
    const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
    if (requestCounter === apiRequestCounter.value) fetchedItems.value = res
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    requestsRunning.value--
  }
}

const tryAutoFetch = async (mode: 'focus' | 'hover' | 'mounted' | 'force', newValue: ModelValueType) => {
  if (loadingLocal.value) return
  if (mode !== 'force') {
    if (props.prefetch === false || props.prefetch !== mode || prefetchCompleted.value) return
  }

  requestsRunning.value++
  try {
    const res = await props.fetchItems(pagination, filterInnerData, filterInnerConfig)
    if (apiRequestCounter.value === 0) {
      fetchedItems.value = res
      if (
        !props.disableAutoSingleSelect &&
        mode === 'mounted' &&
        res.length === 1 &&
        (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0))
      ) {
        modelValue.value = props.multiple ? [res[0]!.value] : res[0]!.value
      }
    }
    prefetchCompleted.value = true
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    requestsRunning.value--
  }
}

const onFocus = async () => {
  isFocused.value = true
  acquireFieldLock.value()
  await tryAutoFetch('focus', modelValue.value)
  emit('focus', modelValue.value)
}

const onMouseEnter = async () => {
  await tryAutoFetch('hover', modelValue.value)
}

const singleItemSelectedTitle = computed(() => {
  if (!props.multiple && selectedItemsCache.value[0]) {
    return selectedItemsCache.value[0].title
  }
  return undefined
})

// The clear of the field empties the search with `null` first: an empty search. A field without focus at that
// moment read its length and threw.
const onSearchUpdate = (query: string | null) => {
  const text = query ?? ''
  if (!props.multiple && !isFocused.value && text.length === 0) return // vuetify fix
  if (singleItemSelectedTitle.value === text) return
  search.value = text
}

// The clear empties the value at once and asks for the list once, for an empty search, through the counter of the
// searches. It asked with the search typed before, outside the counter, wrote that answer whenever it came, and
// emptied the value only after it.
const onClickClear = () => {
  modelValue.value = props.multiple ? [] : null
  apiRequestCounter.value++
  apiSearch('', apiRequestCounter.value)
}

const onChipCloseClick = (closedItem: ValueObjectOption<T>) => {
  if (isArray(modelValue.value)) {
    modelValue.value = modelValue.value.filter((item) => item !== closedItem.value)
    return
  }
  if (closedItem.value === modelValue.value && props.clearable) {
    modelValue.value = null
  }
}

watchDebounced(
  search,
  (newValue: string | null, oldValue: string | null) => {
    const query = newValue ?? ''
    if (query === (oldValue ?? '')) return
    if (query.length > 0 && query.length < props.minSearchChars) return
    if (query.length === 0 && props.prefetch === false) {
      fetchedItems.value = []
      return
    }
    apiRequestCounter.value++
    apiSearch(query, apiRequestCounter.value)
    emit('searchChangeDebounced', query)
  },
  { debounce: SEARCH_DEBOUNCE_MS }
)

watch(search, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    emit('searchChange', newValue)
  }
})

const onAutocompleteModelUpdate = (newValue: ValueObjectOption<T> | readonly ValueObjectOption<T>[] | null) => {
  const cloned = cloneDeep(newValue) as ValueObjectOption<T> | ValueObjectOption<T>[] | null
  modelValueSelected.value = cloned
  if (isNull(cloned) || isUndefined(cloned)) {
    modelValue.value = null
    return
  }
  if (isArray(cloned)) {
    modelValue.value = cloned.map((item) => item.value)
    return
  }
  modelValue.value = cloned.value
}

const noDataText = computed(() => {
  if (loadingLocal.value) {
    return '$vuetify.loading'
  }
  if (fetchedItems.value.length === 0 && search.value.length < props.minSearchChars) {
    return isUndefined(props.minSearchText)
      ? t('common.filter.filterMinChars', { min: props.minSearchChars })
      : props.minSearchText
  }
  return undefined
})

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (isFirstLoad.value) {
      isFirstLoad.value = false
      await tryAutoFetch('mounted', newValue)
    }
    if (collabOptions.value.enabled && isFocused.value) {
      changeFieldData.value(newValue)
    }
    if (isEmpty(newValue)) {
      resetToEmptyState(newValue)
      return
    }
    await loadListItems(newValue as T[] | T)
  },
  { immediate: true }
)

defineExpose({
  tryLoadModelValue,
})
</script>

<template>
  <VAutocomplete
    :model-value="modelValueAutocomplete as any"
    :items="allItems"
    no-filter
    :multiple="multiple"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :chips="chips || multiple || closableChips"
    :hide-details="hideDetails"
    :loading="loadingComputed"
    :disabled="disabledComputed"
    :readonly="readonly"
    :no-data-text="noDataText"
    return-object
    autocomplete="off"
    :hide-selected="closableChips"
    :closable-chips="closableChips && !loadingComputed && !disabledComputed && !readonly"
    @update:search="onSearchUpdate"
    @update:model-value="onAutocompleteModelUpdate"
    @blur="onBlur"
    @focus="onFocus"
    @mouseenter="onMouseEnter"
    @click:clear="onClickClear"
  >
    <template #item="{ props: itemProps, internalItem }">
      <VListItem
        v-bind="itemProps"
        :title="internalItem.raw.title"
        :subtitle="internalItem.raw.subtitle"
      />
    </template>
    <template #chip="{ props: chipProps, internalItem }">
      <VChip
        :closable="chipProps.closable as boolean"
        close-label="common.button.remove"
        size="small"
        :text="`${internalItem.title} (${internalItem.raw.subtitle})`"
        :disabled="internalItem.props.disabled"
        @click:close="onChipCloseClick(internalItem.raw)"
      >
        {{ internalItem.raw.title }}
        <span
          v-if="internalItem.raw.subtitle"
          class="font-italic pl-1"
        >
          ({{ internalItem.raw.subtitle }})
        </span>
      </VChip>
    </template>
    <template #label>
      <span
        v-if="!hideLabel"
        :key="requiredComputed + ''"
      >
        {{ labelComputed }}
        <span
          v-if="requiredComputed"
          class="a-required-mark"
        />
      </span>
    </template>
    <template
      v-if="lockedByUserLocal"
      #append-inner
    >
      <slot
        name="locked"
        :user-id="lockedByUserLocal"
      >
        <ACollabLockedByUser
          v-if="collab"
          :id="lockedByUserLocal"
          :users="collab.cachedUsers"
        />
      </slot>
    </template>
    <template
      v-if="$slots.append"
      #append
    >
      <slot name="append" />
    </template>
  </VAutocomplete>
</template>
