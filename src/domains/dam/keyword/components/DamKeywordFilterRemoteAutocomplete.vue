<script lang="ts" setup>
import { useKeywordSelectActions } from '@/domains/dam/keyword/composables/keywordActions'
import { useKeywordInnerFilter } from '@/domains/dam/keyword/filter/KeywordFilter'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/shared/types/common'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'

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
