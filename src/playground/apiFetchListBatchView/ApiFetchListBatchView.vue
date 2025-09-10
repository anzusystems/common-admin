<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { damClient } from '@/playground/mock/coreDamClient'
import { onMounted, ref } from 'vue'
import { usePagination } from '@/labs/filters/pagination'
import { ENTITY, SYSTEM_CORE_DAM, useFetchAssetList } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useApiFetchListBatch } from '@/labs/api/useApiFetchListBatch'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

const showData = ref(false)

// data1 - search api
const itemsBatch1 = ref<any[]>([])
const itemsList1 = ref<any[]>([])

const filterFieldsList = [] satisfies readonly MakeFilterOption[]
const listFiltersStore = createFilterStore(filterFieldsList)

const { filterConfig, filterData } = createFilter(filterFieldsList, listFiltersStore, {
  system: SYSTEM_CORE_DAM,
  subject: ENTITY,
})

const useFetchCustomFormListAll = () =>
  useApiFetchListBatch<any[]>(damClient, SYSTEM_CORE_DAM, ENTITY, '/adm/v1/asset/licence/:licenceId', {
    licenceId: 100000,
  })
const { executeFetch: fetchAssetListAll } = useFetchCustomFormListAll()

const { pagination } = usePagination('id')
pagination.value.rowsPerPage = 100

// data 2 - standard api
const itemsBatch2 = ref<any[]>([])
const itemsList2 = ref<any[]>([])

const { pagination: pagination2 } = usePagination('id')
pagination.value.rowsPerPage = 100

const useFetchUserList = () => useApiFetchList<any[]>(damClient, SYSTEM_CORE_DAM, ENTITY, '/adm/v1/user')
const { executeFetch: fetchUserList } = useFetchUserList()

const useFetchUserListAll = () => useApiFetchListBatch<any[]>(damClient, SYSTEM_CORE_DAM, ENTITY, '/adm/v1/user')
const { executeFetch: fetchUserListAll } = useFetchUserListAll()

const { executeFetch: fetchAssetList } = useFetchAssetList(damClient, 100000)

onMounted(async () => {
  itemsList1.value = await fetchAssetList(pagination, filterData, filterConfig, undefined, undefined, true)
  itemsBatch1.value = await fetchAssetListAll(filterData, filterConfig, undefined, undefined, 'id', true)

  itemsList2.value = await fetchUserList(pagination2, filterData, filterConfig)
  itemsBatch2.value = await fetchUserListAll(filterData, filterConfig, undefined, undefined, 'id')
})
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <VSwitch v-model="showData">
        Toggle data
      </VSwitch>
      <VRow>
        <VCol cols="6">
          <p>list items count, search api: {{ itemsList1.length }}</p>
          <div v-if="showData">
            <div
              v-for="(item, index) in itemsList1"
              :key="index"
            >
              {{ item.id }}
            </div>
          </div>
        </VCol>
        <VCol cols="6">
          <p>batch items count, search api: {{ itemsBatch1.length }}</p>
          <div v-if="showData">
            <div
              v-for="(item, index) in itemsBatch1"
              :key="index"
            >
              {{ item.id }}
            </div>
          </div>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="6">
          <p>list items count, normal api: {{ itemsList2.length }}</p>
          <div v-if="showData">
            <div
              v-for="(item, index) in itemsList2"
              :key="index"
            >
              {{ item.id }}
            </div>
          </div>
        </VCol>
        <VCol cols="6">
          <p>batch items count, normal api: {{ itemsBatch2.length }}</p>
          <div v-if="showData">
            <div
              v-for="(item, index) in itemsBatch2"
              :key="index"
            >
              {{ item.id }}
            </div>
          </div>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
