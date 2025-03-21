<script lang="ts" setup>
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import { computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/components/filter2/filterInjectionKeys.ts'
import { isArray, isUndefined } from '@/utils/common.ts'
import { useFilterHelpers } from '@/composables/filter/filterFactory.ts'

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
    filterData[props.name] = newValue
    emit('change')
  },
})

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const { t } = useI18n()

const label = computed(() => {
  return filterConfigCurrent.value.titleT ? t(filterConfigCurrent.value.titleT) : undefined
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const updateSelected = () => {
  if (!isArray(modelValue.value) || (isArray(modelValue.value) && modelValue.value.length === 0)) return
  filterSelected.value.set(
    props.name,
    modelValue.value.map((modelItemValue) => {
      const found = props.items.find((item) => item.value === modelItemValue)
      if (found) return { title: found.title, value: found.value }
      return { title: modelItemValue as string, value: modelItemValue as string }
    })
  )
}

watch(submitResetCounter, () => {
  updateSelected()
})
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
    @click:clear.stop="clearField"
  />
</template>
