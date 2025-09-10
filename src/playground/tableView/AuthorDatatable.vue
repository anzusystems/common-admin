<script lang="ts" setup>
import { onMounted, provide } from 'vue'
import ADatatableOrdering from '@/labs/filters/ADatatableOrdering.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ABooleanValue from '@/components/ABooleanValue.vue'
import ADatetime from '@/components/datetime/ADatetime.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import ADatatablePagination from '@/labs/filters/ADatatablePagination.vue'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { SORT_BY_ID } from '@/composables/system/datatableColumns'
import { useAuthorListFilter } from '@/playground/tableView/authorFilter'
import { useAuthorListActions } from '@/playground/tableView/authorActions'
import { createDatatableColumnsConfig } from '@/labs/filters/datatableColumns'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import { usePagination } from '@/labs/filters/pagination'
import { useFilterHelpers } from '@/labs/filters/filterFactory'
import { useDebounceFn } from '@vueuse/core'

type DatatableItem = DamAuthor

const { filterData, filterConfig } = useAuthorListFilter()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const { pagination } = usePagination(SORT_BY_ID)
provide(DatatablePaginationKey, pagination)

const { fetchList, listItems, datatableHiddenColumns } = useAuthorListActions()
const { submitFilter } = useFilterHelpers(filterData, filterConfig)

const getList = useDebounceFn(() => {
  fetchList(pagination, filterData, filterConfig)
})

const onRowClick = (event: unknown, { item }: { item: DatatableItem }) => {
  console.log(item)
}

const { columnsVisible, columnsAll, columnsHidden } = createDatatableColumnsConfig(
  [
    { key: 'id' },
    { key: 'name' },
    { key: 'identifier' },
    { key: 'type' },
    { key: 'flags.reviewed' },
    { key: 'createdAt' },
    { key: 'modifiedAt' },
  ],
  datatableHiddenColumns,
  'coreDam',
  'author'
)

const sortByChange = () => {
  filterConfig.touched = false
  submitFilter(pagination, getList)
}

onMounted(() => {
  getList()
})

defineExpose({
  refresh: getList,
})
</script>

<template>
  <div>
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
        @click:row="onRowClick"
      >
        <template #item.flags.reviewed="{ item }: { item: DatatableItem }">
          <ABooleanValue
            chip
            :value="item.flags.reviewed"
          />
        </template>
        <template #item.createdAt="{ item }: { item: DatatableItem }">
          <ADatetime :date-time="item.createdAt" />
        </template>
        <template #item.modifiedAt="{ item }: { item: DatatableItem }">
          <ADatetime :date-time="item.modifiedAt" />
        </template>
        <template #item.actions="{ item }: { item: DatatableItem }">
          <div class="d-flex justify-end">
            <ATableCopyIdButton :id="item.id" />
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
