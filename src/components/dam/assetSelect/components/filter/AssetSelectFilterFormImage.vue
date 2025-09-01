<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterBooleanSelect from '@/components/filter/AFilterBooleanSelect.vue'
import DamAuthorFilterRemoteAutocomplete from '@/components/damImage/uploadQueue/author/DamAuthorFilterRemoteAutocomplete.vue'
import DamUserFilterRemoteAutocomplete from '@/components/dam/user/DamUserFilterRemoteAutocomplete.vue'
import { computed, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'

const { filter, filterTouch, filterUnTouch, fetchAssetList } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()
const { selectConfig, selectedLicenceId } = storeToRefs(assetSelectStore)

const extSystem = computed(() => {
  const found = selectConfig.value.find((config) => config.licence === selectedLicenceId.value)
  if (found) {
    return found.extSystem
  }
  return undefined
})

const onAnyFilterUpdate = () => {
  filterTouch()
}

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList()
}

watch(extSystem, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    filter.keywordIds.model = []
    filter.authorIds.model = []
  }
})
// todo filters!!!
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
      <AFilterString
        v-model="filter.assetAndMainFileIds"
        @update:model-value="onAnyFilterUpdate"
        @keydown.enter="submitFilter"
      />
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
      <DamAuthorFilterRemoteAutocomplete
        :key="extSystem"
        v-model="filter.authorIds"
        :ext-system="extSystem"
        @update:model-value="onAnyFilterUpdate"
      />
    </VCol>
  </VRow>
  <VRow>
    <VCol :cols="12">
      <DamUserFilterRemoteAutocomplete
        v-model="filter.createdByIds"
        @update:model-value="onAnyFilterUpdate"
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
