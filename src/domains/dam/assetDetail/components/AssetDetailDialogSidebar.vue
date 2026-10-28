<script setup lang="ts">
import type { DocId, IntegerId } from '@/shared/types/common'
import type { DamAssetStatusType, DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { AssetFileFailReasonType, AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'
import { computed } from 'vue'
import AssetInfobox from '@/domains/dam/assetDetail/components/AssetInfobox.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import AssetDetailSidebarFrame from '@/domains/dam/assetDetail/components/AssetDetailSidebarFrame.vue'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    extSystem: IntegerId
    assetId: DocId
    isVideo: boolean
    isAudio: boolean
    isImage: boolean
    isDocument: boolean
    dataCy?: string
    assetStatus: DamAssetStatusType
    assetType: DamAssetTypeType
    assetMainFileStatus?: AssetFileProcessStatusType | undefined
    assetMainFileFailReason?: AssetFileFailReasonType | undefined
    configName?: string
  }>(),
  {
    assetMainFileStatus: undefined,
    assetMainFileFailReason: undefined,
    dataCy: undefined,
    configName: undefined,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(damConfigName)
const simpleMode = computed(() => simpleAssetSidebarEnabled && props.isImage)
</script>

<template>
  <AssetDetailSidebarFrame
    :queue-key="queueKey"
    :config-name="damConfigName"
    :roi-tab="isImage"
    :simple-mode="simpleMode"
  >
    <template #prepend>
      <AssetInfobox
        :asset-status="assetStatus"
        :asset-main-file-status="assetMainFileStatus"
        :asset-main-file-fail-reason="assetMainFileFailReason"
      />
    </template>
    <template #info="{ isActive }">
      <AssetDetailSidebarMetadata
        :queue-key="queueKey"
        :ext-system="extSystem"
        :config-name="damConfigName"
        :is-active="isActive"
        :asset-type="assetType"
      />
    </template>
  </AssetDetailSidebarFrame>
</template>
