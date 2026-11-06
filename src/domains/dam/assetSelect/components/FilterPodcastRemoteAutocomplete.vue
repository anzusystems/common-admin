<script lang="ts" setup>
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import {
  usePodcastInnerFilter,
  usePodcastSelectActions,
} from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/shared/types/common'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

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
const { fetchItems, fetchItemsByIds } = usePodcastSelectActions(props.licenceId, useDamConfigName())
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
