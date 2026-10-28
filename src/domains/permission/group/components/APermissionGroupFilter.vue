<script lang="ts" setup>
import { inject } from 'vue'
import AFilterString from '@/domains/filters/components/AFilterString.vue'
import AFilterWrapper from '@/domains/filters/components/AFilterWrapper.vue'
import { FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { isUndefined } from '@/shared/utils/common'

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
