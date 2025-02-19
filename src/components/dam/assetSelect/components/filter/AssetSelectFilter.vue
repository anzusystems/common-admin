<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import AssetSelectFilterFormImage from '@/components/dam/assetSelect/components/filter/AssetSelectFilterFormImage.vue'

const { t } = useI18n()
const { fetchAssetList, resetAssetList, filterUnTouch, filterIsTouched } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()
const { selectedLicenceId, selectConfig, assetType } = storeToRefs(assetSelectStore)

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList(assetType.value)
}

const resetFilter = () => {
  resetAssetList()
  filterUnTouch()
}

const componentComputed = computed(() => {
  switch (assetSelectStore.assetType) {
    // case DamAssetType.Image: // todo
    //   return AssetSelectFilterFormImage
    default:
      return AssetSelectFilterFormImage
  }
})

watch(
  selectedLicenceId,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    submitFilter()
  },
  { immediate: false }
)
</script>

<template>
  <div class="subject-select-filter">
    <div class="subject-select-filter__content">
      <VForm
        name="search2"
        class="px-2 pt-4"
        @submit.prevent="submitFilter"
      >
        <VRow v-if="selectConfig.length > 1">
          <VCol :cols="12">
            <VSelect
              v-model="selectedLicenceId"
              :label="t('common.assetSelect.filter.licence')"
              :items="selectConfig"
              item-title="licenceName"
              item-value="licence"
            />
          </VCol>
        </VRow>
        <component :is="componentComputed" />
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
