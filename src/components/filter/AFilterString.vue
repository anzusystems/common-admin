<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    placeholder: undefined,
    dataCy: 'filter-string',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: Filter): void
}>()

const value = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: newValue } })
  },
})

const { clearOne } = useFilterHelpers()

const { t } = useI18n()

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (props.modelValue.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (props.modelValue.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (props.modelValue.variant === 'contains') return t('common.model.filterPlaceholder.contains')
  return ''
})
</script>

<template>
  <VTextField
    v-model="value"
    :label="label"
    :placeholder="placeholderComputed"
    :clearable="!modelValue.mandatory"
    :data-cy="dataCy"
    @click:clear.stop="clearOne(modelValue)"
  />
</template>
