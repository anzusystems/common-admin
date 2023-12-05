<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/types/coreDam/AssetFile'
import { DamAssetStatus } from '@/types/coreDam/Asset'
import AssetFileFailReasonChip from '@/components/damImage/uploadQueue/components/AssetFileFailReasonChip.vue'

withDefaults(
  defineProps<{
    assetStatus: DamAssetStatus
    assetMainFileStatus?: AssetFileProcessStatus | undefined
    assetMainFileFailReason?: AssetFileFailReason | undefined
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
    class="w-100 pa-2 text-caption"
  >
    <VAlert
      dark
      type="warning"
    >
      {{ t('common.damImage.asset.detail.info.status.duplicate') }}
    </VAlert>
  </div>
  <div
    v-if="assetMainFileStatus && assetMainFileStatus === AssetFileProcessStatus.Failed"
    class="w-100 pa-2 text-caption"
  >
    <VAlert
      dark
      type="error"
    >
      {{ t('common.damImage.asset.detail.info.status.failed') }}
      <div v-if="assetMainFileFailReason">
        <br>
        <AssetFileFailReasonChip :reason="assetMainFileFailReason" />
      </div>
    </VAlert>
  </div>
  <div
    v-else-if="assetStatus === DamAssetStatus.Deleting"
    class="w-100 pa-2 text-caption"
  >
    <VAlert
      dark
      type="error"
    >
      {{ t('common.damImage.asset.detail.info.status.deleting') }}
    </VAlert>
  </div>
  <div
    v-else-if="assetStatus === DamAssetStatus.Draft"
    class="w-100 pa-2 text-caption"
  >
    <VAlert
      dark
      type="warning"
    >
      {{ t('common.damImage.asset.detail.info.status.draft') }}
    </VAlert>
  </div>
</template>
