<script lang="ts" setup>
import ADatatable from '@/components/ADatatable.vue'
import { useTableColumns } from '@/composables/system/tableColumns'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { usePagination } from '@/composables/system/pagination'
import { reactive, ref } from 'vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import { makeFilterHelper, useFilterHelpers } from '@/composables/filter/filterHelpers'
import AFilterString from '@/components/filter/AFilterString.vue'

const data = ref(
  JSON.parse(
    '{"hasNextPage":false,"data":[{"licence":100000,"imagePreview":{"imageFile":"892d7b56-7423-4428-86a0-2d366685d823","position":0,"createdAt":"2023-02-08T08:17:29.000000Z","modifiedAt":"2023-02-08T08:17:29.000000Z","id":"1eda7890-77ff-6004-b57e-53b83fe7d4e7","createdBy":1763600,"modifiedBy":1763600,"_resourceName":"imagePreview","_system":"coreDam"},"texts":{"title":"This American Life","description":""},"attributes":{"rssUrl":"https:\\/\\/www.thisamericanlife.org\\/podcast\\/rss.xml","mode":"import","lastImportStatus":"not_imported"},"id":"8fe7196e-1480-41b6-b0b3-1c73c79f3452","createdBy":1763600,"modifiedBy":1763600,"createdAt":"2023-02-08T08:17:29.000000Z","modifiedAt":"2023-02-08T08:17:29.000000Z","links":{"image_list":{"type":"image","url":"http:\\/\\/admin-image.smedata.localhost\\/image\\/w0-h200\\/892d7b56-7423-4428-86a0-2d366685d823.jpg","requestedWidth":0,"requestedHeight":200,"title":"0x200"}},"_resourceName":"podcast","_system":"coreDam"}],"totalCount":11}'
  )
)

const columns = useTableColumns([{ name: 'texts.title' }, { name: 'createdAt' }, { name: 'modifiedAt' }])

const pagination = usePagination()

const makeFilter = makeFilterHelper('system', 'subject')

const filter = reactive({
  id: {
    ...makeFilter({ name: 'id' }),
  },
  title: {
    ...makeFilter({ name: 'title', field: 'texts.title', variant: 'startsWith' }),
  },
})

const getList = () => {
  console.log('get list')
}

const { resetFilter, submitFilter } = useFilterHelpers()
</script>

<template>
  <VCard>
    <VCardTitle>Datatable</VCardTitle>
    <VCardText>
      <VForm name="search" @submit.prevent="submitFilter(filter, pagination, getList)">
        <AFilterWrapper @reset-filter="resetFilter(filter, pagination, getList)">
          <VRow align="start">
            <VCol cols="4">
              <AFilterString v-model="filter.id" />
            </VCol>
            <VCol cols="4">
              <AFilterString v-model="filter.title" />
            </VCol>
          </VRow>
        </AFilterWrapper>
      </VForm>

      <ASystemEntityScope system="system" subject="subject">
        <ADatatable :data="data.data" :columns="columns" />
      </ASystemEntityScope>

      <ADatatablePagination v-model="pagination" @change="getList" />
    </VCardText>
  </VCard>
</template>
