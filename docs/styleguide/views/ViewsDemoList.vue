<script lang="ts" setup>
import { useDemoListActions, useDemoListFilter } from './viewsDemoData'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { createDatatableColumnsConfig, DatatableOrderingOption } from '@/composables/system/datatableColumns'
import { onMounted } from 'vue'
import ViewsDemoFilter from './ViewsDemoFilter.vue'
import ADatatableOrdering from '@/components/ADatatableOrdering.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import ATableDetailButton from '@/components/buttons/table/ATableDetailButton.vue'
import ATableEditButton from '@/components/buttons/table/ATableEditButton.vue'
import { i18n } from '@/plugins/i18nDocs'

type DatatableItem = any

const filter = useDemoListFilter()
const { resetFilter, submitFilter } = useFilterHelpers()
const { fetchList, listItems, datatableHiddenColumns } = useDemoListActions()

const { columnsVisible, columnsAll, columnsHidden, updateSortBy, pagination } = createDatatableColumnsConfig(
  [
    { key: 'id' },
    { key: 'datetime' },
    { key: 'levelName' },
    { key: 'message' },
    { key: 'context.appVersion' },
    { key: 'context.contextId' },
    { key: 'context.userId' },
    { key: 'context.ip' },
  ],
  datatableHiddenColumns,
  'common',
  'log',
  false,
  undefined,
  i18n
)

const getList = () => {
  fetchList(pagination, filter)
}

const sortByChange = (option: DatatableOrderingOption) => {
  updateSortBy(option.sortBy)
  getList()
}

onMounted(() => {
  getList()
})
</script>

<template>
  <div>
    <ViewsDemoFilter
      @submit-filter="submitFilter(filter, pagination, getList)"
      @reset-filter="resetFilter(filter, pagination, getList)"
    />
    <div>
      <div class="d-flex align-center">
        <VSpacer />
        <ADatatableOrdering @sort-by-change="sortByChange" />
        <ADatatableConfigButton
          v-model:columns-hidden="columnsHidden"
          :columns-all="columnsAll"
        />
      </div>
      <VDataTableServer
        class="a-datatable"
        :headers="columnsVisible"
        :items="listItems"
        :items-length="listItems.length"
        item-value="id"
      >
        <template #item.actions="{ item }: { item: DatatableItem }">
          <div class="d-flex justify-end">
            <ATableCopyIdButton :id="item.id" />
            <ATableDetailButton
              :record-id="item.id"
              route-name="name"
            />
            <ATableEditButton
              :record-id="item.id"
              route-name="name"
            />
          </div>
        </template>
        <template #bottom>
          <ADatatablePagination
            v-model="pagination"
            @change="getList"
          />
        </template>
      </VDataTableServer>
    </div>
  </div>
</template>
