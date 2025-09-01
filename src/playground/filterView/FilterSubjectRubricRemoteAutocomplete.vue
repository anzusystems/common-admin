<script lang="ts" setup>
import { computed, provide, watch } from 'vue'
import type { IntegerId } from '@/types/common'
import { isArray, isNull } from '@/utils/common'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import {
  fetchItems,
  fetchItemsByIds,
  useSubjectRubricInnerFilter,
} from '@/playground/filterView/FilterSubjectRubricTools'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

const props = withDefaults(
  defineProps<{
    name: string
    siteId?: IntegerId | IntegerId[] | null
  }>(),
  {
    siteId: () => [],
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const { filterData, filterConfig } = useSubjectRubricInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)

const siteModel = computed(() => {
  if (isNull(props.siteId)) return []
  if (!isArray(props.siteId)) return [props.siteId]
  return props.siteId
})

watch(
  siteModel,
  (newSiteModel: IntegerId[]) => {
    filterData.site = newSiteModel
  },
  { immediate: true }
)
</script>

<template>
  <AFilterRemoteAutocomplete
    :key="siteModel.join('-')"
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="text"
    @change="emit('change')"
  />
</template>
