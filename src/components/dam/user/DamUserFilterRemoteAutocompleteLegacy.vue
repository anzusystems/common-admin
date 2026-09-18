<script lang="ts" setup>
/**
 * Bridge for consumers still binding a legacy `Filter` inside a legacy filter bar. The labs
 * `AFilterRemoteAutocomplete` cannot live there -- it injects `FilterConfigKey`, `FilterDataKey`,
 * `FilterSelectedKey` and `FilterSubmitResetCounterKey`, and only a labs filter bar provides them.
 * Delete this file once its consumers migrate; the api layer under it is already labs.
 */
// eslint-disable-next-line anzu/no-deprecated-imports
import type { Filter, FilterBag } from '@/types/Filter'
import type { Pagination as PaginationLegacy } from '@/types/Pagination'
import { useDamUserSelectAction } from '@/components/dam/user/damUserSelectActions'
import { useDamUserFilter, useDamUserInnerFilter } from '@/components/dam/user/DamUserFilter'
import AFilterRemoteAutocomplete from '@/components/filter/AFilterRemoteAutocomplete.vue'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { usePagination } from '@/labs/filters/pagination'

const props = withDefaults(
  defineProps<{
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)

const modelValue = defineModel<Filter>({ required: true })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)

const { fetchItems, fetchItemsByIds } = useDamUserSelectAction(damClient)

const { filterData, filterConfig } = useDamUserInnerFilter()
// The host builds its own legacy pagination and never sorts this list.
const { pagination } = usePagination(null)

// The legacy host still calls with its own bag and pagination object. Everything it can vary comes
// across -- the typed query, the page size and the page. Its sort does not, because there is never
// one to carry: the host builds its pagination from `filter-sort-by`, which this bridge pins to
// `null` below, so the two sides are already agreed that this list is unsorted.
const fetchItemsBridge = (legacyPagination: PaginationLegacy, legacyFilterBag: FilterBag) => {
  filterData.lastName = legacyFilterBag.lastName.model as string | null
  pagination.value = {
    ...pagination.value,
    rowsPerPage: legacyPagination.rowsPerPage,
    page: legacyPagination.page,
  }
  return fetchItems(pagination, filterData, filterConfig)
}

// Still the legacy bag: it is what the deprecated host binds its own inputs to.
const innerFilter = useDamUserFilter()
</script>

<template>
  <AFilterRemoteAutocomplete
    v-model="modelValue"
    :fetch-items="fetchItemsBridge"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
    filter-by-field="lastName"
    :filter-sort-by="null"
  />
</template>
