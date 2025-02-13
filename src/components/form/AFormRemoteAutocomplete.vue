<script lang="ts" setup>
import { watchDebounced } from '@vueuse/core'
import { computed, inject, type Ref, ref, toRefs, watch } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { usePagination } from '@/composables/system/pagination'
import { cloneDeep, isArray, isDefined, isNull, isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { ErrorObject } from '@vuelidate/core'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import type { CollabComponentConfig, CollabFieldData } from '@/components/collab/types/Collab'
import { useCollabField } from '@/components/collab/composables/collabField'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

type fetchItemsByIdsType =
  | ((ids: IntegerId[]) => Promise<ValueObjectOption<IntegerId>[]>)
  | ((ids: DocId[]) => Promise<ValueObjectOption<DocId>[]>)

const props = withDefaults(
  defineProps<{
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
    filterSortBy?: string | null
    disableInitFetch?: boolean | undefined
    loading?: boolean
    collab?: CollabComponentConfig
    disabled?: boolean | undefined
    chips?: boolean
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
    filterSortBy: 'createdAt',
    disableInitFetch: false,
    loading: false,
    collab: undefined,
    disabled: undefined,
    chips: false,
  }
)
const emit = defineEmits<{
  (e: 'searchChange', data: string): void
  (e: 'searchChangeDebounced', data: string): void
  (e: 'blur', data: DocId | IntegerId | DocId[] | IntegerId[] | null): void
  (e: 'focus', data: DocId | IntegerId | DocId[] | IntegerId[] | null): void
}>()

const modelValue = defineModel<DocId | IntegerId | DocId[] | IntegerId[] | null | any>({
  required: true,
  set(newValue) {
    return isArray(newValue) ? cloneDeep(newValue) : newValue
  },
})

const modelValueSelected = defineModel<DocId | IntegerId | DocId[] | IntegerId[] | null | any>('selected', {
  required: false,
  default: null,
  set(newValue) {
    return isArray(newValue) ? cloneDeep(newValue) : newValue
  },
})

const modelValueAutocomplete = ref<DocId | IntegerId | DocId[] | IntegerId[] | null | any>(null)

const apiRequestCounter = ref(0)

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
    props.collab.field
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
const autoFetchTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)

const { t } = useI18n()

const { innerFilter } = toRefs(props)

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const onBlur = () => {
  isFocused.value = false
  emit('blur', modelValue.value)
  props.v?.$touch()
  releaseFieldLock.value(modelValue.value)
}

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return props.v.$errors.map((item: ErrorObject) => item.$message)
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
  return props.v?.required && props.v?.required.$params.type === 'required'
})

const disabledComputed = computed(() => {
  if (isDefined(props.disabled)) return props.disabled
  return !!lockedByUserLocal.value
})

const multipleComputedVuetifyTypeFix = computed(() => {
  if (props.multiple === false) return false
  return true as unknown as undefined
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const pagination = usePagination(props.filterSortBy)
const fetchedItems = ref<ValueObjectOption<string | number>[]>([])
const selectedItemsCache = ref<ValueObjectOption<string | number>[]>([])

const allItems = computed<ValueObjectOption<DocId | IntegerId>[]>(() => {
  const final = new Map()
  selectedItemsCache.value.forEach((value) => {
    final.set(value.value, { value: value.value, title: value.title, subtitle: value.subtitle })
  })
  fetchedItems.value.forEach((value) => {
    final.set(value.value, { value: value.value, title: value.title, subtitle: value.subtitle })
  })
  return Array.from(final, ([key, value]) => {
    return { value: key, title: value.title, subtitle: value.subtitle }
  })
})

const loadingLocal = ref(false)
const loadingComputed = computed(() => {
  if (loadingLocal.value) return true
  return props.loading
})

const apiSearch = async (query: string, requestCounter: number) => {
  loadingLocal.value = true
  const filterField = innerFilter.value[props.filterByField]
  if (isUndefined(filterField)) {
    throw new Error('AFormRemoteAutocomplete incorrect innerFilter or filterByField setup.')
  }
  filterField.model = query
  const res = await props.fetchItems(pagination, innerFilter.value)
  if (requestCounter === apiRequestCounter.value) fetchedItems.value = res
  loadingLocal.value = false
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
  loadingLocal.value = true
  const res = await props.fetchItems(pagination, innerFilter.value)
  if (apiRequestCounter.value === 0) fetchedItems.value = res
  loadingLocal.value = false
}
const onFocus = () => {
  isFocused.value = true
  clearAutoFetchTimer()
  autoFetch()
  emit('focus', modelValue.value)
  acquireFieldLock.value()
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

watchDebounced(
  search,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      apiRequestCounter.value++
      apiSearch(newValue, apiRequestCounter.value)
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

const updateSelected = (newValue: any) => {
  if (isArray(newValue)) {
    return newValue.map((id: any) => {
      const foundObject = allItems.value.find((obj) => obj.value === id)
      return foundObject ? foundObject : { title: `${id}`, value: id }
    })
  }
  const found = allItems.value.find((item) => item.value === newValue)
  if (found) return found
  return { value: newValue, title: newValue }
}

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (collabOptions.value.enabled && isFocused.value) {
      changeFieldData.value(newValue)
    }
    if (isNull(newValue) || isUndefined(newValue) || (isArray(newValue) && newValue.length === 0)) {
      selectedItemsCache.value = []
      modelValueSelected.value = isArray(newValue) ? [] : null
      modelValueAutocomplete.value = isArray(newValue) ? [] : null
      if (props.disableInitFetch || autoFetched.value === true) return
      autoFetchTimer.value = setTimeout(() => {
        autoFetch()
      }, 2000)
      return
    }
    const found = await tryToLoadFromLocalData(newValue)
    if (found) {
      const selectedNewValue = updateSelected(newValue)
      modelValueSelected.value = selectedNewValue
      modelValueAutocomplete.value = selectedNewValue
      return
    }
    if (isArray<IntegerId | DocId>(newValue)) {
      loadingLocal.value = true
      selectedItemsCache.value = await props.fetchItemsByIds(newValue as Array<IntegerId & DocId>)
      const selectedNewValue = updateSelected(newValue)
      modelValueSelected.value = selectedNewValue
      modelValueAutocomplete.value = selectedNewValue
      loadingLocal.value = false
      return
    }
    loadingLocal.value = true
    selectedItemsCache.value = await props.fetchItemsByIds([newValue as DocId & IntegerId])
    const selectedNewValue = updateSelected(newValue)
    modelValueSelected.value = selectedNewValue
    modelValueAutocomplete.value = selectedNewValue
    loadingLocal.value = false
  },
  { immediate: true }
)

const onAutocompleteModelUpdate = (newValue: any) => {
  modelValueSelected.value = newValue
  if (isNull(newValue)) {
    modelValue.value = null
    return
  }
  if (isArray(newValue)) {
    modelValue.value = newValue.map((item: any) => item.value)
    return
  }
  modelValue.value = newValue.value
}
</script>

<template>
  <VAutocomplete
    :model-value="modelValueAutocomplete"
    :items="allItems"
    no-filter
    :multiple="multipleComputedVuetifyTypeFix"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :chips="chips || multiple"
    :hide-details="hideDetails"
    :loading="loadingComputed"
    :disabled="disabledComputed"
    return-object
    @update:search="onSearchUpdate"
    @update:model-value="onAutocompleteModelUpdate"
    @blur="onBlur"
    @focus="onFocus"
    @click:clear="onClickClear"
  >
    <template #item="{ props: itemProps, item }">
      <VListItem
        v-bind="itemProps"
        :title="item.raw.title"
        :subtitle="item.raw.subtitle"
      />
    </template>
    <template #chip="{ props: chipProps, item }">
      <VChip
        :closable="chipProps.closable as boolean"
        size="small"
        :text="`${item.title} (${item.raw.subtitle})`"
        :disabled="item.props.disabled"
      >
        {{ item.raw.title }}
        <span
          v-if="item.raw.subtitle"
          class="font-italic pl-1"
        >
          ({{ item.raw.subtitle }})
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
          class="required"
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
  </VAutocomplete>
</template>
