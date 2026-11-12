<script lang="ts" setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import ADatetimePicker from '@/domains/ui/datetime/components/ADatetimePicker.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import { isString, isUndefined } from '@/shared/utils/common'
import { useFilterClearHelpers } from '@/domains/filters/composables/filterFactory'
import type { DatetimeUTCNullable } from '@/shared/types/common'
import { dateTimePretty } from '@/shared/utils/datetime'

const props = withDefaults(
  defineProps<{
    name: string
    dataCy?: string
  }>(),
  {
    dataCy: 'filter-datepicker',
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

// The setup above throws unless the field is configured.
const filterConfigCurrent = computed(() => filterConfig.fields[props.name]!)

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
  // `clearOne` writes the value the picker was about to emit, so the picker skips its emit as unchanged.
  // The model setter never runs, so the bookkeeping happens here.
  filterConfig.touched = true
  emit('change')
}

const updateSelected = () => {
  // This component has no watcher on `filterData`, so `updateSelected` runs only from the model setter.
  // `ADatetimePicker` suppresses that for programmatic changes, so deleting the chip here would be dead code.
  // Known gap: a datetime restored from a hash or local storage shows no chip.
  // Adding the watcher makes `clearField` recreate the chip for a non-empty
  // default and adds datetime chips to eight lists that have none.
  if (!isString(modelValue.value) || modelValue.value.length === 0) return
  filterSelected.value.set(props.name, [{ title: dateTimePretty(modelValue.value), value: modelValue.value }])
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
