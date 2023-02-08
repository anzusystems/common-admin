<script lang="ts" setup>
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Filter } from '@/types/Filter'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: Filter
    items: ValueObjectOption<string | number>[]
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'change'): void
}>()
const { clearOne } = useFilterHelpers()

const value = computed({
  get() {
    return props.modelValue.model
  },
  set(newValue) {
    emit('update:modelValue', { ...props.modelValue, ...{ model: newValue } })
    emit('change')
  },
})
</script>

<template>
  <VAutocomplete
    v-model="value"
    :items="items"
    :label="modelValue.title"
    :multiple="modelValue.multiple"
    :clearable="!modelValue.mandatory"
    data-cy="filter-value"
    @clear="clearOne(modelValue)"
    @change="emit('change')"
  />
</template>
