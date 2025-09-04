<script lang="ts" setup>
import { computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isArray, isBoolean, isNull, isNumber, isString, isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'

const props = withDefaults(
  defineProps<{
    name: string
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    placeholder: undefined,
    dataCy: 'filter-string',
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)

if (
  isUndefined(submitResetCounter) ||
  isUndefined(filterSelected) ||
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name]) ||
  isUndefined(filterData) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterData[props.name])
) {
  throw new Error('Incorrect provide/inject config.')
}

const modelValue = computed({
  get() {
    return filterData[props.name]
  },
  set(newValue) {
    filterData[props.name] = newValue
    filterConfig.touched = true
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (filterConfigCurrent.value.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (filterConfigCurrent.value.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (filterConfigCurrent.value.variant === 'search')
    return t('common.model.filterPlaceholder.contains')
  return ''
})

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const updateSelected = () => {
  if (isNumber(modelValue.value)) {
    filterSelected.value.set(props.name, [{ title: modelValue.value + '', value: modelValue.value }])
    return
  }
  if (!isString(modelValue.value)) return
  if (isString(modelValue.value) && modelValue.value.length === 0) {
    filterSelected.value.delete(props.name)
    return
  }
  filterSelected.value.set(props.name, [{ title: modelValue.value, value: modelValue.value }])
}

watch(
  () => filterData[props.name],
  (newValue, oldValue) => {
    if (newValue === oldValue || isBoolean(newValue)) return
    updateSelected()
  },
  { immediate: true }
)
</script>

<template>
  <VTextField
    v-model="modelValue"
    :label="label"
    :placeholder="placeholderComputed"
    :clearable="!filterConfigCurrent.mandatory"
    :data-cy="dataCy"
    hide-details
    autocomplete="off"
    @blur="updateSelected"
    @click:clear.stop="clearField"
  />
</template>
