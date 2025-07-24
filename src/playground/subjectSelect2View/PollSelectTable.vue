<script lang="ts" setup>
import ADatetime from '@/components/datetime/ADatetime.vue'
import PollSelectFilter from '@/playground/subjectSelect2View/PollSelectFilter.vue'
import { generateDatatableMinMaxSelectStrategy } from '@/components/subjectSelect/selectStrategies'
import { type PollDemo, useFetchPollListDemo } from '@/playground/subjectSelectView/pollDemoApi'
import ASubjectSelect from '@/labs/subjectSelect/ASubjectSelect.vue'
import ADatatableOrdering from '@/labs/filters/ADatatableOrdering.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import { usePollSelectStore } from '@/playground/subjectSelect2View/pollSelectStore'
import { useSubjectSelect } from '@/labs/subjectSelect/useSubjectSelect'
import { provide } from 'vue'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'

withDefaults(
  defineProps<{
    minCount?: number
    maxCount?: number
  }>(),
  {
    minCount: 1,
    maxCount: 1,
  }
)
const emit = defineEmits<{
  (e: 'onConfirm', data: Array<PollDemo>): void
}>()

const { datatableHiddenColumns, filterConfig, filterData } = usePollSelectStore()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)
const { executeFetch } = useFetchPollListDemo()

const {
  items,
  selected,
  pagination,
  columnsVisible,
  columnsAll,
  columnsHidden,
  submitFilter,
  resetFilter,
  filterTouched,
  onFetchNextPage,
  onOpen,
  sortByChange,
  getList,
  onRowClick,
  loading,
} = useSubjectSelect<PollDemo>(
  [
    { key: 'id' },
    { key: 'texts.title' },
    { key: 'dates.startOfVoting' },
    { key: 'dates.endOfVoting' },
    { key: 'votes' },
    { key: 'attributes.hideVotes' },
    { key: 'createdAt' },
    { key: 'modifiedAt' },
  ],
  datatableHiddenColumns,
  'cms',
  'poll',
  executeFetch,
  filterData,
  filterConfig
)
provide(DatatablePaginationKey, pagination)

const onConfirm = (items: Array<PollDemo>) => {
  emit('onConfirm', items)
}
</script>

<template>
  <ASubjectSelect
    v-model:pagination="pagination"
    :min-count="minCount"
    :max-count="maxCount"
    :selected-items="selected"
    :submit-filter="submitFilter"
    :reset-filter="resetFilter"
    :loading="loading"
    @on-open="onOpen"
    @on-fetch-next-page="onFetchNextPage"
    @on-page-change="getList"
    @on-confirm="onConfirm"
  >
    <template #activator="{ props: activatorProps }">
      <VBtn
        color="primary"
        v-bind="activatorProps"
      >
        Select Poll
      </VBtn>
    </template>
    <template #filter>
      <PollSelectFilter
        v-model:touched="filterTouched"
        @submit-filter="submitFilter"
      />
    </template>
    <template #second-bar-right>
      <ADatatableOrdering @sort-by-change="sortByChange" />
      <ADatatableConfigButton
        v-model:columns-hidden="columnsHidden"
        :columns-all="columnsAll"
      />
    </template>
    <template #content>
      <VDataTableServer
        v-model="selected"
        show-select
        class="a-datatable"
        :headers="columnsVisible"
        :items="items"
        :items-length="items.length"
        :loading="loading"
        item-value="id"
        return-object
        :select-strategy="generateDatatableMinMaxSelectStrategy(minCount, maxCount) as any"
        @click:row.stop="onRowClick"
      >
        <template #item.data-table-select="{ internalItem, toggleSelect, isSelected }">
          <VCheckboxBtn
            :disabled="!internalItem.selectable"
            :model-value="isSelected([internalItem])"
            @click.prevent="toggleSelect(internalItem)"
            @change="toggleSelect(internalItem)"
          />
        </template>
        <template #item.dates.startOfVoting="{ item }: { item: PollDemo }">
          <ADatetime :date-time="item.dates.startOfVoting" />
        </template>
        <template #item.dates.endOfVoting="{ item }: { item: PollDemo }">
          <ADatetime :date-time="item.dates.endOfVoting" />
        </template>
        <template #item.createdAt="{ item }: { item: PollDemo }">
          <ADatetime :date-time="item.createdAt" />
        </template>
        <template #item.modifiedAt="{ item }: { item: PollDemo }">
          <ADatetime :date-time="item.modifiedAt" />
        </template>
        <template #bottom />
      </VDataTableServer>
    </template>
  </ASubjectSelect>
</template>
