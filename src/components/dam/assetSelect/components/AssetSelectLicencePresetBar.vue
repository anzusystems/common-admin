<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { IntegerId } from '@/types/common'
import { useAssetSelectPresetControl } from '@/components/dam/assetSelect/composables/assetSelectPresetControl'

const props = defineProps<{
  selectLicences: IntegerId[]
  listViews: IntegerId[]
}>()

const { t } = useI18n()

// Host configuration, not expected to change after mount.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { selectLicences, listViews } = props

const { selectedLicenceIds, licenceTitle, licenceBadge } = useAssetSelectPresetControl(
  selectLicences,
  listViews,
)
</script>

<template>
  <div class="asset-select-preset-bar d-flex flex-wrap align-center system-border-b px-2 py-1">
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
          <span
            v-if="licenceBadge(licenceId)"
            class="font-weight-bold mr-1"
          >
            {{ licenceBadge(licenceId) }}
          </span>
          {{ licenceTitle(licenceId) }}
        </VChip>
      </div>
    </div>
  </div>
</template>
