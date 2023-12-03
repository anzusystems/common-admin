<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { damClient } from '@/playground/mock/coreDamClient'
import { apiFetchListBatch } from '@/services/api/apiFetchListBatch'
import { onMounted, reactive, ref } from 'vue'
import { usePagination } from '@/composables/system/pagination'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { apiFetchList } from '@/services/api/apiFetchList'
import { ENTITY, fetchAssetList, SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

const showData = ref(false)

// data1 - search api
const itemsBatch1 = ref<any[]>([])
const itemsList1 = ref<any[]>([])

const filter = useAssetListFilter()
const fetchAssetListAll = (licenceId = 100000) =>
  apiFetchListBatch<any[]>(
    damClient,
    '/adm/v1/asset' + '/licence/:licenceId',
    { licenceId },
    'id',
    true,
    filter,
    1,
    SYSTEM_CORE_DAM,
    ENTITY
  )

const pagination = usePagination('id')
pagination.rowsPerPage = 100

// data 2 - standard api
const itemsBatch2 = ref<any[]>([])
const itemsList2 = ref<any[]>([])

const pagination2 = usePagination('id')
pagination.rowsPerPage = 100

const filter2 = reactive({})

const fetchUserList = () =>
  apiFetchList<any[]>(damClient, '/adm/v1/user', {}, pagination2, filter2, SYSTEM_CORE_DAM, ENTITY)

const fetchUserListAll = () =>
  apiFetchListBatch<any[]>(damClient, '/adm/v1/user', {}, 'id', true, filter2, 1, SYSTEM_CORE_DAM, ENTITY)

onMounted(async () => {
  itemsList1.value = await fetchAssetList(damClient, 100000, pagination, filter)
  itemsBatch1.value = await fetchAssetListAll()

  itemsList2.value = await fetchUserList()
  itemsBatch2.value = await fetchUserListAll()
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
