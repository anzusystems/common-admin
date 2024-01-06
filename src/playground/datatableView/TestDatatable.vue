<script lang="ts" setup>
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { onMounted, ref } from 'vue'
import { fetchTestList } from '@/playground/datatableView/testApi'
import { createDatatableColumnsConfig, type DatatableOrderingOption } from '@/composables/system/datatableColumns'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import ADatatableOrdering from '@/components/ADatatableOrdering.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import TestFilter from '@/playground/datatableView/TestFilter.vue'
import { useTestListFilter } from '@/playground/datatableView/testFilter'
import type { IntegerId } from '@/types/common'
import ADatatable from '@/components/datatable/ADatatable.vue'

type DatatableItem = { id: IntegerId, discriminator: string, texts: { title: string } }

const listLoading = ref(false)
const datatableHiddenColumns = ref<Array<string>>([])
const listItems = ref<Array<any>>([])

const fetchList = async (pagination: Pagination, filterBag: FilterBag) => {
  listLoading.value = true
  try {
    listItems.value = await fetchTestList(pagination, filterBag)
  } catch (error) {
    // showErrorsDefault(error)
  } finally {
    listLoading.value = false
  }
}

const filter = useTestListFilter()

const { resetFilter, submitFilter } = useFilterHelpers()

const onRowClick = ({ event, item }: { event: unknown, item: DatatableItem }) => {
  console.log('onRowClick', item, event)
}

const { columnsVisible, columnsAll, columnsHidden, updateSortBy, pagination } = createDatatableColumnsConfig(
  [
    { key: 'id' },
    { key: 'discriminator' },
    { key: 'docId' },
    { key: 'texts.title' },
    { key: 'texts.seoTitle' },
    { key: 'site' },
    { key: 'mainRubric' },
    { key: 'status' },
    { key: 'dates.publicPublishedAt' },
    { key: 'dates.expireAt' },
    { key: 'dates.publishedAt' },
    { key: 'collab' },
    { key: 'createdAt' },
    { key: 'modifiedAt' },
  ],
  datatableHiddenColumns,
  'cms',
  'article'
)

const getList = () => {
  let sortBy: string | null = 'id'
  if (filter.text.model || filter.title.model) {
    sortBy = null
  }
  pagination.sortBy = sortBy
  fetchList(pagination, filter)
}

const sortByChange = (option: DatatableOrderingOption) => {
  updateSortBy(option.sortBy)
  getList()
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
    <TestFilter
      @submit-filter="submitFilter(filter, pagination, getList)"
      @reset-filter="resetFilter(filter, pagination, getList)"
    />
    <div>
      <div class="d-flex align-center">
        <VSpacer />
        <ADatatableOrdering
          variant="most-relevant"
          @sort-by-change="sortByChange"
        />
        <ADatatableConfigButton
          v-model:columns-hidden="columnsHidden"
          :columns-all="columnsAll"
        />
      </div>
      <ADatatable
        class="a-datatable"
        :columns="columnsVisible"
        :items="listItems"
        :items-length="listItems.length"
        item-value="id"
        @click:row="onRowClick"
      >
        <template #item.discriminator="{ item }: { item: DatatableItem }">
          {{ item.discriminator }}
        </template>
        <template #item.texts.title="{ item }: { item: DatatableItem }">
          <div class="line-clamp-2">
            {{ item.texts.title }}
          </div>
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
      </ADatatable>
    </div>
  </div>
</template>
