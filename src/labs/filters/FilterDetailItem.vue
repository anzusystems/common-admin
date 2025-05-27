<script setup lang="ts">
import { computed, inject } from 'vue'
import { FilterConfigKey } from '@/labs/filters/filterInjectionKeys'
import { isUndefined } from '@/utils/common'
import AFilterEmpty from '@/labs/filters/AFilterEmpty.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import AFilterBooleanSelect from '@/labs/filters/AFilterBooleanSelect.vue'
import AFilterDatetimePicker from '@/labs/filters/AFilterDatetimePicker.vue'
import AFilterInteger from '@/labs/filters/AFilterInteger.vue'

const props = withDefaults(
  defineProps<{
    name: string
  }>(),
  {}
)

const filterConfig = inject(FilterConfigKey)

if (
  isUndefined(filterConfig) ||
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  isUndefined(filterConfig.fields[props.name])
) {
  throw new Error('Incorrect provide/inject config.')
}

const filterConfigCurrent = computed(() => filterConfig.fields[props.name])

const componentComputed = computed(() => {
  if (filterConfigCurrent.value.render.skip) return AFilterEmpty
  switch (filterConfigCurrent.value.type) {
    case 'string':
      return AFilterString
    case 'datetime':
      return AFilterDatetimePicker
    case 'boolean':
      return AFilterBooleanSelect
    case 'integer':
      return AFilterInteger
    default:
      return AFilterEmpty
  }
})
</script>

<template>
  <component
    :is="componentComputed"
    :name="name"
  />
</template>
