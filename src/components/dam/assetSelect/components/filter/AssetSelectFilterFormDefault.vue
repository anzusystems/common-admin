<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AFilterString from '@/components/filter/AFilterString.vue'

const { filter, fetchAssetList, filterTouch, filterUnTouch } = useAssetSelectActions()

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList()
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
