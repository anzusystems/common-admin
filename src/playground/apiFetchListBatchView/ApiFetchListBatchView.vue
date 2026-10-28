<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { damClient } from '@/playground/mock/coreDamClient'
import { onMounted, ref } from 'vue'
import { usePagination } from '@/domains/api/composables/pagination'
import { ENTITY, useFetchAssetList } from '@/domains/dam/api/damAssetApi'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiFetchListBatch } from '@/domains/api/composables/useApiFetchListBatch'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'

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
  useApiFetchListBatch<any>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: '/adm/v1/asset/licence/:licenceId',
    urlParams: { licenceId: 100000 },
  })
const { execute: fetchAssetListAll } = useFetchCustomFormListAll()

const { pagination } = usePagination('id')
pagination.value.rowsPerPage = 100

// data 2 - standard api
const itemsBatch2 = ref<any[]>([])
const itemsList2 = ref<any[]>([])

const { pagination: pagination2 } = usePagination('id')
pagination.value.rowsPerPage = 100

const useFetchUserList = () =>
  useApiFetchList<any>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: '/adm/v1/user',
  })
const { execute: fetchUserList } = useFetchUserList()

const useFetchUserListAll = () =>
  useApiFetchListBatch<any>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: '/adm/v1/user',
  })
const { execute: fetchUserListAll } = useFetchUserListAll()

const { execute: fetchAssetList } = useFetchAssetList(damClient, '/adm/v1/asset', 100000)

onMounted(async () => {
  itemsList1.value = await fetchAssetList(pagination, filterData, filterConfig, {
    forceElastic: true,
  })
  itemsBatch1.value = await fetchAssetListAll(filterData, filterConfig, {
    sortBy: 'id',
    sortDesc: true,
  })

  itemsList2.value = await fetchUserList(pagination2, filterData, filterConfig)
  itemsBatch2.value = await fetchUserListAll(filterData, filterConfig, { sortBy: 'id' })
})
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <VSwitch v-model="showData">Toggle data</VSwitch>
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
