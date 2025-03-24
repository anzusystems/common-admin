<script setup lang="ts">
import { computed, inject } from 'vue'
import { FilterConfigKey } from '@/components/filter2/filterInjectionKeys.ts'
import { isUndefined } from '@/utils/common.ts'
import AFilterEmpty from '@/components/filter2/variant/AFilterEmpty.vue'
import AFilterString from '@/components/filter2/variant/AFilterString.vue'
import AFilterBooleanSelect from '@/components/filter2/variant/AFilterBooleanSelect.vue'
import AFilterDatetimePicker from '@/components/filter2/variant/AFilterDatetimePicker.vue'
import AFilterInteger from '@/components/filter2/variant/AFilterInteger.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter2/variant/AFilterValueObjectOptionsSelect.vue'

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
    case 'valueObject':
      return AFilterValueObjectOptionsSelect
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
