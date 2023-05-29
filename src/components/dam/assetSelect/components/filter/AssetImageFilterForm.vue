<script lang="ts" setup>
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterBooleanSelect from '@/components/filter/AFilterBooleanSelect.vue'

const { filter, filterTouch, filterUnTouch, fetchAssetList } = useAssetListActions()

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
