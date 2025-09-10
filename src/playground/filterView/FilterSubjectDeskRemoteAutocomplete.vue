<script lang="ts" setup>
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import {
  fetchItems,
  fetchItemsByIds,
  useSubjectDeskInnerFilter,
} from '@/playground/filterView/FilterSubjectDeskTools'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

withDefaults(
  defineProps<{
    name: string
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const { filterData, filterConfig } = useSubjectDeskInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteAutocomplete
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="name"
    @change="emit('change')"
  />
</template>
