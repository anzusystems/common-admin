<script lang="ts" setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import ADatetimePicker from '@/components/datetime/ADatetimePicker.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import { isString, isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'
import type { DatetimeUTCNullable } from '@/types/common'
import { dateTimePretty } from '@/utils/datetime'

const props = withDefaults(
  defineProps<{
    name: string
    dataCy?: string
  }>(),
  {
    dataCy: 'filter-datepicker',
  },
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
    return filterData[props.name] as DatetimeUTCNullable
  },
  set(newValue: DatetimeUTCNullable) {
    filterData[props.name] = newValue
    updateSelected()
    filterConfig.touched = true
    emit('change')
  },
})

const { t } = useI18n()

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
  // `clearOne` writes the value the picker was about to emit, so its own emit is skipped as
  // unchanged and the model setter below never runs - the bookkeeping has to happen here.
  filterConfig.touched = true
  emit('change')
}

const updateSelected = () => {
  // Unlike its siblings this component has no watcher on `filterData`, so `updateSelected` only
  // ever runs from the model setter - which `ADatetimePicker` suppresses for a programmatic
  // change. Deleting the chip here would be dead code. The gap that does exist is the opposite
  // one: a datetime restored from a hash or local storage never shows a chip at all. Adding the
  // watcher is not mechanical - it makes `clearField` recreate the chip for a non-empty default,
  // and starts showing datetime chips on eight lists that have none today.
  if (!isString(modelValue.value) || modelValue.value.length === 0) return
  filterSelected.value.set(props.name, [
    { title: dateTimePretty(modelValue.value), value: modelValue.value },
  ])
}
</script>

<template>
  <ADatetimePicker
    v-model="modelValue"
    :data-cy="dataCy"
    :clearable="!filterConfigCurrent.mandatory"
    :default-value="filterConfigCurrent.default as DatetimeUTCNullable"
    :label="label"
    v-bind="$attrs"
    @after-clear="clearField"
  />
</template>
