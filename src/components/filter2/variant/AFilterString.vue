<script lang="ts" setup generic="T extends FilterField">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isUndefined } from '@/utils/common.ts'
import { type AllowedFilterData, type FilterField, useFilterHelpers } from '@/composables/filter/filterFactory.ts'

const props = withDefaults(
  defineProps<{
    config: T
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    placeholder: undefined,
    dataCy: 'filter-string',
  }
)

const modelValue = defineModel<AllowedFilterData>({ required: true })

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
}
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
