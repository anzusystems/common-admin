<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ADatetimePicker from '@/components/ADatetimePicker.vue'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    dataCy?: string
  }>(),
  {
    dataCy: 'filter-datepicker',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
}>()

const value = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: newValue } })
  },
})

const { t } = useI18n()

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})
</script>

<template>
  <ADatetimePicker
    v-model="value"
    :data-cy="dataCy"
    :clearable="!modelValue.mandatory"
    :default-value="modelValue.default"
    :label="label"
  />
</template>
