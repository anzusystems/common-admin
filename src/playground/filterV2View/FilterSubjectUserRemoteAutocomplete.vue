<script lang="ts" setup>
import {
  fetchItemsMinimal,
  fetchItemsMinimalByIds,
  useSubjectUserInnerFilter,
} from '@/playground/filterV2View/FilterSubjectUserTools'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/components/filter2/filterInjectionKeys'
import AFilterRemoteAutocompleteWithMinimal2 from '@/components/filter2/variant/AFilterRemoteAutocompleteWithMinimal2.vue'

withDefaults(
  defineProps<{
    name: string
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const { filterData, filterConfig } = useSubjectUserInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <AFilterRemoteAutocompleteWithMinimal2
    :name="name"
    :fetch-items-minimal="fetchItemsMinimal"
    :fetch-items-minimal-by-ids="fetchItemsMinimalByIds"
    filter-by-field="lastName"
    item-title="title"
    @change="emit('change')"
  >
    <template #item="{ props: itemProps, item: itemItem }">
      <VListItem
        v-bind="itemProps"
        title=""
      >
        <VListItemTitle>
          {{ itemItem.title }}
          <VIcon
            v-if="itemItem.raw?.raw?.active || itemItem.raw?.active"
            icon="mdi-check"
            class="text-success ml-1"
            size="small"
            title="mainSite"
          />
        </VListItemTitle>
      </VListItem>
    </template>
    <template #chip="{ props: chipProps, item: chipItem }">
      <VChip v-bind="chipProps">
        {{ chipItem.title }}
        <VIcon
          v-if="chipItem.raw?.raw?.active || chipItem.raw?.active"
          icon="mdi-check"
          class="text-success ml-1"
          size="small"
          title="mainSite"
        />
      </VChip>
    </template>
  </AFilterRemoteAutocompleteWithMinimal2>
</template>
