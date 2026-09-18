<script lang="ts" setup>
/**
 * Bridge for consumers still binding a legacy `Filter` inside a legacy filter bar. The labs
 * `AFilterRemoteAutocomplete` cannot live there -- it injects `FilterInnerConfigKey`/`FilterInnerDataKey`,
 * which only a labs filter bar provides. Delete this file once they migrate; the api layer under it
 * is already labs.
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

// The legacy host still calls with its own bag and pagination object; only the typed query and the
// page size carry over, and the labs fetch reads everything else off the labs filter.
const fetchItemsBridge = (legacyPagination: PaginationLegacy, legacyFilterBag: FilterBag) => {
  filterData.lastName = legacyFilterBag.lastName.model as string | null
  pagination.value = { ...pagination.value, rowsPerPage: legacyPagination.rowsPerPage }
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
