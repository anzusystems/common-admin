<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed, inject } from 'vue'
import { isNull, isUndefined } from '@/utils/common'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'

interface BooleanSelectOption {
  value: 0 | 1 | -1
  title: string
}

const props = withDefaults(
  defineProps<{
    name: string
    allT?: string
    trueT?: string
    falseT?: string
    dataCy?: string
  }>(),
  {
    dataCy: 'filter-boolean',
    allT: 'common.model.all',
    trueT: 'common.model.boolean.true',
    falseT: 'common.model.boolean.false',
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
  get(): BooleanSelectOption {
    if (isUndefined(filterData[props.name]) || isNull(filterData[props.name]))
      return {
        value: -1,
        title: t(props.allT),
      }
    return filterData[props.name] ? { value: 1, title: t(props.trueT) } : { value: 0, title: t(props.falseT) }
  },
  set(newValue: BooleanSelectOption) {
    let returnValue: null | boolean = null
    if (newValue?.value === 1) returnValue = true
    if (newValue?.value === 0) returnValue = false
    filterData[props.name] = returnValue
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

const items = computed<BooleanSelectOption[]>(() => {
  return [
    { value: -1, title: t(props.allT) },
    { value: 1, title: t(props.trueT) },
    { value: 0, title: t(props.falseT) },
  ]
})

const { clearOne } = useFilterClearHelpers()

const clearField = () => {
  clearOne(props.name, filterData, filterConfig)
  filterSelected.value.delete(props.name)
}

const updateSelected = () => {
  if (modelValue.value.value === -1) {
    filterSelected.value.delete(props.name)
    return
  }
  filterSelected.value.set(props.name, [{ title: modelValue.value.title, value: modelValue.value.value }])
}
</script>

<template>
  <VSelect
    v-model="modelValue"
    :data-cy="dataCy"
    :label="label"
    :items="items"
    :clearable="!filterConfigCurrent.mandatory && modelValue.value !== -1"
    return-object
    hide-details
    @click:clear.stop="clearField"
  />
</template>
