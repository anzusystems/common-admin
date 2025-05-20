<script setup lang="ts">
import { computed, inject } from 'vue'
import { FilterConfigKey } from '@/components/filter2/filterInjectionKeys'
import { isUndefined } from '@/utils/common'
import AFilterEmpty from '@/components/filter2/variant/AFilterEmpty.vue'
import AFilterString2 from '@/components/filter2/variant/AFilterString2.vue'
import AFilterBooleanSelect2 from '@/components/filter2/variant/AFilterBooleanSelect2.vue'
import AFilterDatetimePicker2 from '@/components/filter2/variant/AFilterDatetimePicker2.vue'
import AFilterInteger2 from '@/components/filter2/variant/AFilterInteger2.vue'

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
      return AFilterString2
    case 'datetime':
      return AFilterDatetimePicker2
    case 'boolean':
      return AFilterBooleanSelect2
    case 'integer':
      return AFilterInteger2
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
