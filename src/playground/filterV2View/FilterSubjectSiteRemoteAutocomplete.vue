<script lang="ts" setup>
import AFilterRemoteAutocomplete2 from '@/components/filter2/variant/AFilterRemoteAutocomplete2.vue'
import {
  fetchItems,
  fetchItemsByIds,
  useSubjectSiteInnerFilter,
} from '@/playground/filterV2View/FilterSubjectSiteTools'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/components/filter2/filterInjectionKeys'

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
  <AFilterRemoteAutocomplete2
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="name"
    debug
    @change="emit('change')"
  />
</template>
