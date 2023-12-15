<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterBooleanSelect from '@/components/filter/AFilterBooleanSelect.vue'

const { filter, filterTouch, filterUnTouch, fetchAssetList } = useAssetSelectActions()

const onAnyFilterUpdate = () => {
  filterTouch()
}

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList()
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
  <VRow>
    <VCol :cols="12">
      <AFilterBooleanSelect
        v-model="filter.described"
        @update:model-value="onAnyFilterUpdate"
      />
    </VCol>
  </VRow>
  <VRow>
    <VCol :cols="12">
      <AFilterBooleanSelect
        v-model="filter.visible"
        @update:model-value="onAnyFilterUpdate"
      />
    </VCol>
  </VRow>
  <VRow>
    <VCol>
      <AFilterBooleanSelect
        v-model="filter.generatedBySystem"
        @update:model-value="onAnyFilterUpdate"
      />
    </VCol>
  </VRow>
</template>
