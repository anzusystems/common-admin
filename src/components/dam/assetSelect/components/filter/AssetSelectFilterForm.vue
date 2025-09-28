<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import AFilterBooleanSelect from '@/labs/filters/AFilterBooleanSelect.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import DamKeywordFilterRemoteAutocomplete
  from '@/components/damImage/uploadQueue/keyword/DamKeywordFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/types/common'
import DamAuthorFilterRemoteAutocomplete
  from '@/components/damImage/uploadQueue/author/DamAuthorFilterRemoteAutocomplete.vue'
import DamUserFilterRemoteAutocomplete from '@/components/dam/user/DamUserFilterRemoteAutocomplete.vue'
import AssetDistributionServiceNameFilter
  from '@/components/dam/assetSelect/components/filter/AssetDistributionServiceNameFilter.vue'
import { DamAssetType } from '@/types/coreDam/Asset'

const { filterData } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()
const { selectConfig, selectedLicenceId, assetType } = storeToRefs(assetSelectStore)

const extSystem = computed<IntegerId | undefined>(() => {
  const found = selectConfig.value.find((config) => config.licence === selectedLicenceId.value)
  if (found) {
    return found.extSystem
  }
  return undefined
})

watch(extSystem, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    filterData.keywordIds = []
    filterData.authorIds = []
  }
})
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
  <VRow v-if="assetType === DamAssetType.Audio || assetType === DamAssetType.Video">
    <VCol>
      <AssetDistributionServiceNameFilter
        :key="selectedLicenceId"
        :licence-id="selectedLicenceId"
        name="distributedInServices"
      />
    </VCol>
  </VRow>
</template>
