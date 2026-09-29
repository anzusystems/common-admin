<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import {
  type AssetFileFailReasonType,
  AssetFileProcessStatus,
  type AssetFileProcessStatusType,
} from '@/domains/dam/types/AssetFile'
import { DamAssetStatus, type DamAssetStatusType } from '@/domains/dam/types/Asset'
import AssetFileFailReasonChip from '@/domains/dam/assetDetail/components/AssetFileFailReasonChip.vue'

withDefaults(
  defineProps<{
    assetStatus: DamAssetStatusType
    assetMainFileStatus?: AssetFileProcessStatusType | undefined
    assetMainFileFailReason?: AssetFileFailReasonType | undefined
  }>(),
  {
    assetMainFileStatus: undefined,
    assetMainFileFailReason: undefined,
  }
)

const { t } = useI18n()
</script>

<template>
  <div
    v-if="assetMainFileStatus && assetMainFileStatus === AssetFileProcessStatus.Duplicate"
    class="w-100 pa-2 text-body-small"
  >
    <VAlert type="warning">
      {{ t('common.damImage.asset.detail.info.status.duplicate') }}
    </VAlert>
  </div>
  <div
    v-if="assetMainFileStatus && assetMainFileStatus === AssetFileProcessStatus.Failed"
    class="w-100 pa-2 text-body-small"
  >
    <VAlert type="error">
      {{ t('common.damImage.asset.detail.info.status.failed') }}
      <div v-if="assetMainFileFailReason">
        <br />
        <AssetFileFailReasonChip :reason="assetMainFileFailReason" />
      </div>
    </VAlert>
  </div>
  <div
    v-else-if="assetStatus === DamAssetStatus.Deleting"
    class="w-100 pa-2 text-body-small"
  >
    <VAlert type="error">
      {{ t('common.damImage.asset.detail.info.status.deleting') }}
    </VAlert>
  </div>
  <div
    v-else-if="assetStatus === DamAssetStatus.Draft"
    class="w-100 pa-2 text-body-small"
  >
    <VAlert type="warning">
      {{ t('common.damImage.asset.detail.info.status.draft') }}
    </VAlert>
  </div>
</template>
