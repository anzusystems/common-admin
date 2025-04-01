<script lang="ts" setup>
import { useSubjectListFilter } from '@/playground/filterV2View/subjectFilter'
import { createDatatableColumnsConfig, type DatatableOrderingOption } from '@/composables/system/datatableColumns'
import SubjectFilter from '@/playground/filterV2View/SubjectFilter.vue'
import ADatatableOrdering from '@/components/ADatatableOrdering.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectListActions } from '@/playground/filterV2View/subjectTools'
import ADatetime from '@/components/datetime/ADatetime.vue'
import { useFilterHelpers } from '@/composables/filter/filterFactory'

type DatatableItem = any

const { t } = useI18n()

const { filterData, filterConfig } = useSubjectListFilter()
const { fetchList, listItems, datatableHiddenColumns } = useSubjectListActions()

const onRowClick = (event: unknown, { item }: { item: DatatableItem }) => {
  if (!item.id) return
  console.log(item)
}

const { columnsVisible, columnsAll, columnsHidden, updateSortBy, pagination } = createDatatableColumnsConfig(
  [
    { key: 'docId' },
    { key: 'version' },
    { key: 'texts.headline' },
    { key: 'stats' },
    { key: 'site' },
    { key: 'desk' },
    { key: 'rubric' },
    { key: 'articleAuthors', maxWidth: 150 },
    { key: 'status' },
    { key: 'stages', title: t('cms.articleStage.datatable.stage') },
    { key: 'dates.publicPublishedAt' },
    { key: 'dates.expireAt' },
    { key: 'dates.publishedAt' },
    { key: 'createdAt' },
    { key: 'modifiedAt' },
    { key: 'id' },
  ],
  datatableHiddenColumns,
  'system',
  'subject'
)

const getList = () => {
  pagination.sortBy = filterData.text ? null : 'id' // order by score if searching for text
  fetchList(pagination, filterData, filterConfig)
}

const sortByChange = (option: DatatableOrderingOption) => {
  updateSortBy(option.sortBy)
  getList()
}

const { resetFilter, submitFilter, loadStoredFilters } = useFilterHelpers(
  filterData,
  filterConfig,
)

defineExpose({
  refresh: getList,
})

onMounted(() => {
  loadStoredFilters()
  getList()
})
</script>

<template>
  <div>
    <SubjectFilter
      @submit="submitFilter(pagination,getList)"
      @reset="resetFilter(pagination,getList)"
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
        @click:row="onRowClick"
      >
        <template #item.texts.title="{ item }: { item: DatatableItem }">
          {{ item.texts.title }}
        </template>
        <template #item.articleAuthors="{ item }: { item: DatatableItem }">
          {{ item.articleAuthors.map((author: any) => author.id).join(', ') }}
        </template>
        <template #item.createdAt="{ item }: { item: DatatableItem }">
          <ADatetime :date-time="item.createdAt" />
        </template>
        <template #item.actions="{ item }: { item: DatatableItem }">
          {{ item.id }}
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
