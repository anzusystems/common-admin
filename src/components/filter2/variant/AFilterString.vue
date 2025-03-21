<script lang="ts" setup>
import { computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isString, isUndefined } from '@/utils/common.ts'
import { type AllowedFilterData, type FilterField, useFilterHelpers } from '@/composables/filter/filterFactory.ts'
import { FilterSelectedKey, FilterSubmitResetCounterKey } from '@/components/filter2/filterInjectionKeys.ts'

const props = withDefaults(
  defineProps<{
    config: FilterField
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    placeholder: undefined,
    dataCy: 'filter-string',
  }
)

const modelValue = defineModel<AllowedFilterData>({ required: true })

const submitResetCounter = inject(FilterSubmitResetCounterKey)
const filterSelected = inject(FilterSelectedKey)

if (isUndefined(submitResetCounter) || isUndefined(filterSelected)) {
  throw new Error('Incorrect provide/inject config.')
}

const { t } = useI18n()

const label = computed(() => {
  return props.config.titleT ? t(props.config.titleT) : undefined
})

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (props.config.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (props.config.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (props.config.variant === 'contains' || props.config.variant === 'search')
    return t('common.model.filterPlaceholder.contains')
  return ''
})

const { clearOne } = useFilterHelpers()

const clearField = () => {
  clearOne(modelValue, props.config)
  filterSelected.value.delete(props.config.name)
}

const updateSelected = () => {
  if (!isString(modelValue.value) || (isString(modelValue.value) && modelValue.value.length === 0)) return
  filterSelected.value.set(props.config.name, [{ title: modelValue.value, value: '' }])
}

watch(submitResetCounter, () => {
  updateSelected()
})
</script>

<template>
  <VTextField
    v-model="modelValue"
    :label
    :placeholder="placeholderComputed"
    :clearable="!config.mandatory"
    :data-cy
    hide-details
    @click:clear.stop="clearField"
  />
</template>
