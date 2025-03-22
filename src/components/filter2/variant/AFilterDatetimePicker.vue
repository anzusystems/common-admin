<script lang="ts" setup>
import { computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ADatetimePicker from '@/components/datetime/ADatetimePicker.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { isString, isUndefined } from '@/utils/common.ts'
import { useFilterHelpers } from '@/composables/filter/filterFactory.ts'
import type { DatetimeUTCNullable } from '@/types/common.ts'

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
    emit('change')
  },
})

const { t } = useI18n()

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const updateSelected = () => {
  if (!isString(modelValue.value) || (isString(modelValue.value) && modelValue.value.length === 0)) return
  filterSelected.value.set(props.name, [{ title: modelValue.value, value: '' }])
}

watch(submitResetCounter, () => {
  updateSelected()
})
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
