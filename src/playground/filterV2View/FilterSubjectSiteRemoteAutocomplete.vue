<script lang="ts" setup>
import AFilterRemoteSelect from '@/components/filter2/variant/AFilterRemoteSelect.vue'
import {
  fetchItems,
  fetchItemsByIds,
  useSubjectSiteInnerFilter,
} from '@/playground/filterV2View/FilterSubjectSiteTools.ts'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/components/filter2/filterInjectionKeys.ts'

withDefaults(
  defineProps<{
    name: string
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const { filterData, filterConfig } = useSubjectSiteInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteSelect
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="name"
    @change="emit('change')"
  />
</template>
