<script lang="ts" setup>
import { inject } from 'vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import AFilterWrapper from '@/labs/filters/AFilterWrapper.vue'
import { FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import { isUndefined } from '@/utils/common'

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('[APermissionGroupFilter] Incorrect provide/inject config.')
}
</script>

<template>
  <AFilterWrapper
    @submit="emit('submit')"
    @reset="emit('reset')"
  >
    <template #search>
      <AFilterString name="title" />
    </template>
  </AFilterWrapper>
</template>
