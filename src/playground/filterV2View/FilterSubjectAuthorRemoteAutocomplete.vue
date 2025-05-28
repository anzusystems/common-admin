<script lang="ts" setup>
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'
import {
  fetchItems,
  fetchItemsByIds,
  useSubjectAuthorInnerFilter,
} from '@/playground/filterV2View/FilterSubjectAuthorTools'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'

withDefaults(
  defineProps<{
    name: string
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const { filterData, filterConfig } = useSubjectAuthorInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteAutocomplete
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="text"
    @change="emit('change')"
  />
</template>
