<script setup lang="ts">
import {
  AssetDetailTabImageWithRoi,
  useAssetDetailStore
} from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import type { DocId } from '@/types/common'
import { type DamAssetStatus, DamAssetType } from '@/types/coreDam/Asset'
import type { AssetFileFailReason, AssetFileProcessStatus } from '@/types/coreDam/AssetFile'
import { useI18n } from 'vue-i18n'
import AssetInfobox from '@/components/damImage/uploadQueue/components/AssetInfobox.vue'
import AssetDetailSidebarMetadata from '@/components/damImage/uploadQueue/components/AssetDetailSidebarMetadata.vue'
import AssetDetailSidebarROI from '@/components/damImage/uploadQueue/components/AssetDetailSidebarROI.vue'
import AssetDetailSidebarActionsTeleportTarget
  from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsTeleportTarget.vue'
import UploadQueueDialogSingleSidebarMetadata
  from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingleSidebarMetadata.vue'

withDefaults(
  defineProps<{
    queueKey: string
    assetId: DocId
    isVideo: boolean
    isAudio: boolean
    isImage: boolean
    isDocument: boolean
    enableRoiTab: boolean
    showFileInfo: boolean
    dataCy?: string
    assetStatus: DamAssetStatus
    assetType: DamAssetType
    assetMainFileStatus?: AssetFileProcessStatus | undefined
    assetMainFileFailReason?: AssetFileFailReason | undefined
  }>(),
  {
    assetMainFileStatus: undefined,
    assetMainFileFailReason: undefined,
    dataCy: undefined,
  }
)
const emit = defineEmits<{
  (e: 'onSave'): void
}>()

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { activeTab } = storeToRefs(assetDetailStore)
</script>

<template>
  <div class="sidebar-info d-flex w-100 h-100 flex-column">
    <div class="w-100 d-flex flex-column">
      <VTabs
        v-model="activeTab"
        show-arrows
        class="sidebar-info__tabs"
      >
        <VTab
          :value="AssetDetailTabImageWithRoi.Info"
          data-cy="button-meta"
        >
          {{ t('coreDam.asset.detail.tabs.info') }}
        </VTab>
        <VTab
          v-if="isImage && enableRoiTab"
          :value="AssetDetailTabImageWithRoi.ROI"
          data-cy="button-focus"
        >
          {{ t('coreDam.asset.detail.tabs.roi') }}
        </VTab>
      </VTabs>

      <div class="sidebar-info__content">
        <div
          v-if="activeTab === AssetDetailTabImageWithRoi.Info"
          class="py-2"
        >
          <UploadQueueDialogSingleSidebarMetadata
            :queue-key="queueKey"
            :is-active="activeTab === AssetDetailTabImageWithRoi.Info"
            :asset-type="assetType"
            @on-save="emit('onSave')"
          />
        </div>
        <div
          v-if="isImage && activeTab === AssetDetailTabImageWithRoi.ROI"
          class="py-2"
        >
          <AssetDetailSidebarROI :is-active="activeTab === AssetDetailTabImageWithRoi.ROI" />
        </div>
      </div>
      <div class="sidebar-info__actions px-2">
        <AssetDetailSidebarActionsTeleportTarget />
      </div>
    </div>
  </div>
</template>
