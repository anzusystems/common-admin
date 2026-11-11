<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'

const { t } = useI18n()

const assetSelectStore = useAssetSelectStore()
const { selectedLicenceIds, selectConfig } = storeToRefs(assetSelectStore)

const showLicences = computed(() => selectConfig.value.length > 1)
</script>

<template>
  <div
    v-if="showLicences"
    class="asset-select-preset-bar d-flex flex-wrap align-center system-border-b px-2 py-1"
  >
    <div class="a-selected-filters my-1">
      <div class="a-selected-filters__label text-body-small">
        {{ t('common.assetSelect.preset.groupLicences') }}:
      </div>
      <div class="a-selected-filters__chips">
        <VChip
          v-for="licenceId in selectedLicenceIds"
          :key="licenceId"
          size="small"
          class="a-selected-filters__chip"
        >
          {{ assetSelectStore.licenceTitle(licenceId) }}
        </VChip>
      </div>
    </div>
  </div>
</template>
