<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'
import { computed } from 'vue'
import { useAssetListStore } from '@/services/stores/coreDam/assetListStore'
import { AssetType as AssetTypeValue } from '@/types/coreDam/Asset'
import AssetImageFilterForm from '@/components/dam/assetSelect/components/filter/AssetImageFilterForm.vue'
import DefaultFilterForm from '@/components/dam/assetSelect/components/filter/DefaultFilterForm.vue'

const { t } = useI18n()
const { fetchAssetList, resetAssetList, filterUnTouch, filterIsTouched } = useAssetListActions()

const assetListStore = useAssetListStore()

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList()
}

const resetFilter = () => {
  resetAssetList()
  filterUnTouch()
}

const componentComputed = computed(() => {
  switch (assetListStore.assetType) {
    case AssetTypeValue.Image:
      return AssetImageFilterForm
    default:
      return DefaultFilterForm
  }
})
</script>

<template>
  <div class="pa-2">
    <VForm
      name="search2"
      @submit.prevent="submitFilter"
    >
      <Component :is="componentComputed" />
    </VForm>
  </div>
  <div class="pa-2 d-flex align-center justify-center">
    <VBtn
      color="primary"
      class="mr-2"
      :variant="filterIsTouched ? 'flat' : 'text'"
      size="small"
      @click.stop="submitFilter"
    >
      {{ t('common.button.submitFilter') }}
    </VBtn>
    <VBtn
      class="px-2"
      color="light"
      min-width="36px"
      variant="flat"
      size="small"
      @click.stop="resetFilter"
    >
      <VIcon icon="mdi-filter-remove-outline" />
      <VTooltip
        activator="parent"
        location="bottom"
      >
        {{ t('common.button.resetFilter') }}
      </VTooltip>
    </VBtn>
  </div>
</template>
