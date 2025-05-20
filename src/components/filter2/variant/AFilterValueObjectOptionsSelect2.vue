<script lang="ts" setup>
import type { ValueObjectOption } from '@/types/ValueObject'
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys'
import { isArray, isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/composables/filter/filterFactory'

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
const touched = inject(FilterTouchedKey)
const filterSelected = inject(FilterSelectedKey)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)

if (
  isUndefined(submitResetCounter) ||
  isUndefined(touched) ||
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
    updateSelected()
    touched.value = true
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
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    :items="items"
    :chips="filterConfigCurrent.multiple"
    :label="label"
    :multiple="filterConfigCurrent.multiple"
    :clearable="!filterConfigCurrent.mandatory"
    data-cy="filter-value"
    hide-details
    @click:clear.stop="clearField"
  />
</template>
