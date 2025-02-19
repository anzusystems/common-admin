<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AFilterString from '@/components/filter/AFilterString.vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore.ts'
import { storeToRefs } from 'pinia'

const { filter, fetchAssetList, filterTouch, filterUnTouch } = useAssetSelectActions()
const assetSelectStore = useAssetSelectStore()
const { assetType } = storeToRefs(assetSelectStore)

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList(assetType.value)
}

const onAnyFilterUpdate = () => {
  filterTouch()
}
</script>

<template>
  <VRow>
    <VCol :cols="12">
      <AFilterString
        v-model="filter.text"
        @update:model-value="onAnyFilterUpdate"
        @keydown.enter="submitFilter"
      />
    </VCol>
  </VRow>
</template>
