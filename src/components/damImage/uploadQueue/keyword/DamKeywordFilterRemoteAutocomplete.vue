<script lang="ts" setup>
import { useKeywordSelectActions } from '@/components/damImage/uploadQueue/keyword/keywordActions'
import { useKeywordInnerFilter } from '@/components/damImage/uploadQueue/keyword/KeywordFilter'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/types/common'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

const props = withDefaults(
  defineProps<{
    name: string
    extSystem: IntegerId
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItems, fetchItemsByIds } = useKeywordSelectActions(props.extSystem)

const { filterData, filterConfig } = useKeywordInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteAutocomplete
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="text"
    :filter-sort-by="null"
    @change="emit('change')"
  />
</template>
