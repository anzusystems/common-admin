<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    dataCy?: string
  }>(),
  {
    dataCy: undefined,
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
</script>

<template>
  <VTextField
    v-model="value"
    :label="modelValue.title"
    :clearable="!modelValue.mandatory"
    :data-cy="dataCy"
    @click:clear.stop="clearOne(modelValue)"
  />
</template>
