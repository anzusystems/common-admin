<script lang="ts" setup>
/**
 * Bridge for consumers still binding a legacy `Filter` inside a legacy filter bar. The labs
 * `AFilterRemoteAutocomplete` cannot live there -- it injects `FilterInnerConfigKey`/`FilterInnerDataKey`,
 * which only a labs filter bar provides. Delete this file once they migrate; the api layer under it
 * is already labs.
 */
import { useKeywordSelectActions } from '@/components/damImage/uploadQueue/keyword/keywordActions'
import {
  useKeywordInnerFilter,
  useKeywordListFilter,
} from '@/components/damImage/uploadQueue/keyword/KeywordFilter'
// eslint-disable-next-line anzu/no-deprecated-imports
import type { Filter, FilterBag } from '@/types/Filter'
import type { Pagination as PaginationLegacy } from '@/types/Pagination'
import AFilterRemoteAutocomplete from '@/components/filter/AFilterRemoteAutocomplete.vue'
import { usePagination } from '@/labs/filters/pagination'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {}
)

const modelValue = defineModel<Filter>({ required: true })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItems, fetchItemsByIds } = useKeywordSelectActions(props.extSystem)

const { filterData, filterConfig } = useKeywordInnerFilter()
// The host builds its own legacy pagination and never sorts this list.
const { pagination } = usePagination(null)

// The legacy host still calls with its own bag and pagination object; only the typed query and the
// page size carry over, and the labs fetch reads everything else off the labs filter.
const fetchItemsBridge = (legacyPagination: PaginationLegacy, legacyFilterBag: FilterBag) => {
  filterData.text = legacyFilterBag.text.model as string | null
  pagination.value = { ...pagination.value, rowsPerPage: legacyPagination.rowsPerPage }
  return fetchItems(pagination, filterData, filterConfig)
}

// Still the legacy bag: it is what the deprecated host binds its own inputs to.
const innerFilter = useKeywordListFilter()
</script>

<template>
  <AFilterRemoteAutocomplete
    v-model="modelValue"
    :fetch-items="fetchItemsBridge"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
    filter-by-field="text"
    :filter-sort-by="null"
  />
</template>
