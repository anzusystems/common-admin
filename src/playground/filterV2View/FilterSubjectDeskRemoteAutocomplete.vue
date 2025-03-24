<script lang="ts" setup>
import AFilterRemoteAutocomplete from '@/components/filter2/variant/AFilterRemoteAutocomplete.vue'
import { fetchItems, fetchItemsByIds } from '@/playground/filterV2View/FilterSubjectDeskTools'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/components/filter2/filterInjectionKeys'
import { useSubjectDeskInnerFilter } from '@/playground/filterV2View/FilterSubjectDeskTools'

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
