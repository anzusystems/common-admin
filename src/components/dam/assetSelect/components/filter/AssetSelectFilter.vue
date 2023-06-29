<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { DamAssetType as AssetTypeValue } from '@/types/coreDam/Asset'
import AssetSelectFilterFormImage from '@/components/dam/assetSelect/components/filter/AssetSelectFilterFormImage.vue'
import AssetSelectFilterFormDefault from '@/components/dam/assetSelect/components/filter/AssetSelectFilterFormDefault.vue'

const { t } = useI18n()
const { fetchAssetList, resetAssetList, filterUnTouch, filterIsTouched } = useAssetListActions()

const assetListStore = useAssetSelectStore()

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
      return AssetSelectFilterFormImage
    default:
      return AssetSelectFilterFormDefault
  }
})
</script>

<template>
  <div class="subject-select-filter">
    <div class="subject-select-filter__content">
      <VForm
        name="search2"
        class="px-2 pt-4"
        @submit.prevent="submitFilter"
      >
        <Component :is="componentComputed" />
      </VForm>
    </div>
    <div class="subject-select-filter__actions">
      <VBtn
        color="primary"
        class="mx-2"
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
  </div>
</template>
