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
import { useAuthorSelectActions } from '@/components/damImage/uploadQueue/author/authorActions'
import { useAuthorFilter, useAuthorInnerFilter } from '@/components/damImage/uploadQueue/author/AuthorFilter'
import type { IntegerId } from '@/types/common'
import { useI18n } from 'vue-i18n'
import AFilterRemoteAutocompleteWithMinimal from '@/components/filter/AFilterRemoteAutocompleteWithMinimal.vue'
import { usePagination } from '@/labs/filters/pagination'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {}
)

const modelValue = defineModel<Filter>({ required: true })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItemsMinimal, fetchItemsMinimalByIds } = useAuthorSelectActions(props.extSystem)

const { filterData, filterConfig } = useAuthorInnerFilter()
// The host builds its own legacy pagination and never sorts this list.
const { pagination } = usePagination(null)

// The legacy host still calls with its own bag and pagination object. Everything it can vary comes
// across -- the typed query, the page size and the page. Its sort does not, because there is never
// one to carry: the host builds its pagination from `filter-sort-by`, which this bridge pins to
// `null` below, so the two sides are already agreed that this list is unsorted.
const fetchItemsMinimalBridge = (legacyPagination: PaginationLegacy, legacyFilterBag: FilterBag) => {
  filterData.text = legacyFilterBag.text.model as string | null
  pagination.value = {
    ...pagination.value,
    rowsPerPage: legacyPagination.rowsPerPage,
    page: legacyPagination.page,
  }
  return fetchItemsMinimal(pagination, filterData, filterConfig)
}

// Still the legacy bag: it is what the deprecated host binds its own inputs to.
const innerFilter = useAuthorFilter()

const { t } = useI18n()
</script>

<template>
  <AFilterRemoteAutocompleteWithMinimal
    v-model="modelValue"
    :fetch-items-minimal="fetchItemsMinimalBridge"
    :fetch-items-minimal-by-ids="fetchItemsMinimalByIds"
    :inner-filter="innerFilter"
    filter-by-field="text"
    :filter-sort-by="null"
  >
    <template #item="{ props: itemProps, item: itemItem }">
      <VListItem
        v-if="itemItem"
        v-bind="itemProps"
        title=""
      >
        <VListItemTitle>
          {{ itemItem.title }}
          <VIcon
            v-if="itemItem.raw?.raw?.reviewed || itemItem.raw?.reviewed"
            icon="mdi-shield-check"
            class="text-success ml-1"
            size="small"
            :title="t('common.damImage.author.model.flags.reviewed')"
          />
        </VListItemTitle>
      </VListItem>
    </template>
    <template #chip="{ props: chipProps, item: chipItem }">
      <VChip
        v-if="chipItem"
        v-bind="chipProps"
      >
        {{ chipItem.title }}
        <VIcon
          v-if="chipItem.raw?.raw?.reviewed || chipItem.raw?.reviewed"
          icon="mdi-shield-check"
          class="text-success ml-1"
          size="small"
          :title="t('common.damImage.author.model.flags.reviewed')"
        />
      </VChip>
    </template>
  </AFilterRemoteAutocompleteWithMinimal>
</template>
