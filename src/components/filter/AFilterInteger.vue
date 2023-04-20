<script lang="ts" setup>
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import type { Filter } from '@/types/Filter'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// todo cast as integer/number

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    dataCy?: string
  }>(),
  {
    dataCy: 'filter-int',
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

const { clearOne } = useFilterHelpers()

const { t } = useI18n()

const label = computed(() => {
  return props.modelValue.titleT ? t(props.modelValue.titleT) : undefined
})
</script>

<template>
  <VTextField
    v-model="value"
    :label="label"
    :clearable="!modelValue.mandatory"
    :data-cy="dataCy"
    @click:clear.stop="clearOne(modelValue)"
  />
</template>
