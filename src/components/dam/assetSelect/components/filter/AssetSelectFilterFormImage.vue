<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import AFilterBooleanSelect from '@/labs/filters/AFilterBooleanSelect.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'

const { filterData } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()
const { selectConfig, selectedLicenceId } = storeToRefs(assetSelectStore)

const extSystem = computed(() => {
  const found = selectConfig.value.find((config) => config.licence === selectedLicenceId.value)
  if (found) {
    return found.extSystem
  }
  return undefined
})

// const onAnyFilterUpdate = () => {
//   filterTouch()
// }
//
// const submitFilter = () => {
//   filterUnTouch()
//   fetchAssetList()
// }

watch(extSystem, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    filterData.keywordIds = []
    filterData.authorIds = []
  }
})
// todo filters!!!
</script>

<template>
  <VRow>
    <VCol :cols="12">
      <AFilterString name="text" />
    </VCol>
  </VRow>
  <VRow>
    <VCol :cols="12">
      <AFilterString name="assetAndMainFileIds" />
    </VCol>
  </VRow>
  <VRow v-if="extSystem">
    <VCol :cols="12">
      <!--      <DamKeywordFilterRemoteAutocomplete-->
      <!--        :key="extSystem"-->
      <!--        v-model="filter.keywordIds"-->
      <!--        :ext-system="extSystem"-->
      <!--        @update:model-value="onAnyFilterUpdate"-->
      <!--      />-->
    </VCol>
  </VRow>
  <VRow v-if="extSystem">
    <VCol :cols="12">
      <!--      <DamAuthorFilterRemoteAutocomplete-->
      <!--        :key="extSystem"-->
      <!--        v-model="filter.authorIds"-->
      <!--        :ext-system="extSystem"-->
      <!--        @update:model-value="onAnyFilterUpdate"-->
      <!--      />-->
    </VCol>
  </VRow>
  <VRow>
    <VCol :cols="12">
      <!--      <DamUserFilterRemoteAutocomplete-->
      <!--        v-model="filter.createdByIds"-->
      <!--        @update:model-value="onAnyFilterUpdate"-->
      <!--      />-->
    </VCol>
  </VRow>
  <VRow>
    <VCol :cols="12">
      <AFilterBooleanSelect name="described" />
    </VCol>
  </VRow>
  <VRow>
    <VCol :cols="12">
      <AFilterBooleanSelect name="visible" />
    </VCol>
  </VRow>
  <VRow>
    <VCol>
      <AFilterBooleanSelect name="generatedBySystem" />
    </VCol>
  </VRow>
</template>
