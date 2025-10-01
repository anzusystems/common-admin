<script lang="ts" setup>
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'
import {
  usePodcastInnerFilter,
  usePodcastSelectActions,
} from '@/components/dam/assetSelect/components/filter/podcastFilterAndActions'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    name: string
    licenceId: IntegerId
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItems, fetchItemsByIds } = usePodcastSelectActions(props.licenceId)
const { filterData, filterConfig } = usePodcastInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteAutocomplete
    :name="name"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    filter-by-field="title"
    prefetch="hover"
    @change="emit('change')"
  />
</template>
