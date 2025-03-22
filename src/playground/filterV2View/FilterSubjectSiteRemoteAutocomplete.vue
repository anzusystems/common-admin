<script lang="ts" setup>
import AFilterRemoteAutocomplete from '@/components/filter2/variant/AFilterRemoteAutocomplete.vue'
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
  <AFilterRemoteAutocomplete
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    @change="emit('change')"
  />
</template>
