<script lang="ts" setup>
import ASubjectSelectTable from '@/components/subjectSelect/ASubjectSelectTable.vue'
import ADatatableOrdering from '@/components/ADatatableOrdering.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import { toRef } from 'vue'
import ADatetime from '@/components/ADatetime.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import { usePollSelectStore } from '@/playground/subjectSelectView/pollSelectStore'
import PollSelectFilter from '@/playground/subjectSelectView/PollSelectFilter.vue'
import { generateSelectStrategy } from '@/components/subjectSelect/selectStrategies'
import ACheckboxSimple from '@/components/ACheckboxSimple.vue'
import { useSubjectSelect } from '@/components/subjectSelect/useSubjectSelect'
import { fetchPollListDemo, type PollDemo } from '@/playground/subjectSelectView/pollDemoApi'

const props = withDefaults(
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

const { datatableHiddenColumns, filter } = usePollSelectStore()

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
  customToggleSelect,
  onOpen,
  sortByChange,
  getList,
  onRowClick,
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
  fetchPollListDemo,
  filter,
  toRef(props, 'maxCount')
)

const onConfirm = (items: Array<PollDemo>) => {
  emit('onConfirm', items)
}
</script>

<template>
  <ASubjectSelectTable
    v-model:pagination="pagination"
    :min-count="minCount"
    :max-count="maxCount"
    :selected-items="selected"
    :submit-filter="submitFilter"
    :reset-filter="resetFilter"
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
        item-value="id"
        return-object
        :select-strategy="generateSelectStrategy(minCount, maxCount) as any"
        @click:row.stop="onRowClick"
      >
        <template #item.data-table-select="{ internalItem, toggleSelect, isSelected }">
          <ACheckboxSimple
            :disabled="!internalItem.selectable"
            :value="isSelected([internalItem])"
            size="small"
            @on-click="customToggleSelect(toggleSelect, isSelected, internalItem)"
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
        <template #item.actions="{ item }: { item: PollDemo }">
          <div class="d-flex justify-end">
            <ATableCopyIdButton :id="item.id" />
          </div>
        </template>
        <template #bottom />
      </VDataTableServer>
    </template>
  </ASubjectSelectTable>
</template>
