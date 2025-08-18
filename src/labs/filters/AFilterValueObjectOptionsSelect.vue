<script lang="ts" setup>
import type { ValueObjectOption } from '@/types/ValueObject'
import { computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import { isArray, isBoolean, isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'

const props = withDefaults(
  defineProps<{
    name: string
    items: ValueObjectOption<string | number>[]
  }>(),
  {}
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
    console.log('newValue', newValue)
    filterData[props.name] = newValue
    updateSelected()
    filterConfig.touched = true
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const updateSelected = () => {
  if (isArray(modelValue.value) && modelValue.value.length === 0) return
  if (isArray(modelValue.value)) {
    filterSelected.value.set(
      props.name,
      modelValue.value.map((modelItemValue) => {
        const found = props.items.find((item) => item.value === modelItemValue)
        if (found) return { title: found.title, value: found.value }
        return { title: modelItemValue as string, value: modelItemValue as string }
      })
    )
    return
  }
  const found = props.items.find((item) => item.value === modelValue.value)
  if (found) {
    filterSelected.value.set(props.name, [{ title: found.title as string, value: found.value as string }])
  }
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
  {{ filterConfigCurrent.multiple }}
  <VAutocomplete
    v-model="modelValue"
    :items="items"
    :chips="filterConfigCurrent.multiple"
    :label="label"
    :multiple="filterConfigCurrent.multiple"
    :clearable="!filterConfigCurrent.mandatory"
    data-cy="filter-value"
    hide-details
    autocomplete="off"
    @click:clear.stop="clearField"
  />
</template>
