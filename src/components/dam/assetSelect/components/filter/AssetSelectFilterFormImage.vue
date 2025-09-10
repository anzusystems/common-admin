<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import AFilterBooleanSelect from '@/labs/filters/AFilterBooleanSelect.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import DamKeywordFilterRemoteAutocomplete from '@/components/damImage/uploadQueue/keyword/DamKeywordFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/types/common'
import DamAuthorFilterRemoteAutocomplete from '@/components/damImage/uploadQueue/author/DamAuthorFilterRemoteAutocomplete.vue'
import DamUserFilterRemoteAutocomplete from '@/components/dam/user/DamUserFilterRemoteAutocomplete.vue'

const { filterData } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()
const { selectConfig, selectedLicenceId } = storeToRefs(assetSelectStore)

const extSystem = computed<IntegerId | undefined>(() => {
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
  <template v-if="extSystem">
    <VRow>
      <VCol :cols="12">
        <DamKeywordFilterRemoteAutocomplete
          :key="extSystem"
          name="keywordIds"
          :ext-system="extSystem"
        />
      </VCol>
    </VRow>
    <VRow>
      <VCol :cols="12">
        <DamAuthorFilterRemoteAutocomplete
          :key="extSystem"
          name="authorIds"
          :ext-system="extSystem"
        />
      </VCol>
    </VRow>
  </template>
  <VRow>
    <VCol :cols="12">
      <DamUserFilterRemoteAutocomplete name="createdByIds" />
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
