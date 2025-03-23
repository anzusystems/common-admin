<script lang="ts" setup>
import { computed, provide, watch } from 'vue'
import type { IntegerId } from '@/types/common.ts'
import { isArray, isNull } from '@/utils/common.ts'
import AFilterRemoteSelect from '@/components/filter2/variant/AFilterRemoteSelect.vue'
import {
  fetchItems,
  fetchItemsByIds,
  useSubjectRubricInnerFilter,
} from '@/playground/filterV2View/FilterSubjectRubricTools.ts'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/components/filter2/filterInjectionKeys.ts'

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
  <AFilterRemoteSelect
    :key="siteModel.join('-')"
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="text"
    @change="emit('change')"
  />
</template>
