<script setup lang="ts">
import { computed, inject } from 'vue'
import { FilterConfigKey } from '@/domains/filters/utils/filterInjectionKeys'
import { isUndefined } from '@/shared/utils/common'
import AFilterEmpty from '@/domains/filters/components/AFilterEmpty.vue'
import AFilterString from '@/domains/filters/components/AFilterString.vue'
import AFilterBooleanSelect from '@/domains/filters/components/AFilterBooleanSelect.vue'
import AFilterDatetimePicker from '@/domains/filters/components/AFilterDatetimePicker.vue'
import AFilterInteger from '@/domains/filters/components/AFilterInteger.vue'

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

// The setup above throws unless the field is configured.
const filterConfigCurrent = computed(() => filterConfig.fields[props.name]!)

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
