<script setup lang="ts">
import {
  AssetDetailTabImageWithRoi,
  useAssetDetailStore,
} from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import type { DocId, IntegerId } from '@/types/common'
import type { DamAssetStatusType, DamAssetTypeType } from '@/types/coreDam/Asset'
import type { AssetFileFailReasonType, AssetFileProcessStatusType } from '@/types/coreDam/AssetFile'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AssetInfobox from '@/components/damImage/uploadQueue/components/AssetInfobox.vue'
import AssetDetailSidebarMetadata from '@/components/damImage/uploadQueue/components/AssetDetailSidebarMetadata.vue'
import AssetDetailSidebarROI from '@/components/damImage/uploadQueue/components/AssetDetailSidebarROI.vue'
import AssetDetailSidebarActionsTeleportTarget from '@/components/damImage/uploadQueue/components/AssetDetailSidebarActionsTeleportTarget.vue'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

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
    configName: 'default',
  }
)

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { activeTab } = storeToRefs(assetDetailStore)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(props.configName)
const simpleMode = computed(() => simpleAssetSidebarEnabled && props.isImage)
</script>

<template>
  <div class="sidebar-info d-flex w-100 h-100 flex-column" :class="{ 'sidebar-info--no-tabs': simpleMode }">
    <div class="w-100 d-flex flex-column">
      <VTabs
        v-if="!simpleMode"
        v-model="activeTab"
        show-arrows
        class="sidebar-info__tabs"
      >
        <VTab
          :value="AssetDetailTabImageWithRoi.Info"
          data-cy="button-meta"
        >
          {{ t('common.damImage.asset.detail.tabs.info') }}
        </VTab>
        <VTab
          v-if="isImage"
          :value="AssetDetailTabImageWithRoi.ROI"
          data-cy="button-focus"
        >
          {{ t('common.damImage.asset.detail.tabs.roi') }}
        </VTab>
      </VTabs>

      <div class="sidebar-info__content">
        <AssetInfobox
          :asset-status="assetStatus"
          :asset-main-file-status="assetMainFileStatus"
          :asset-main-file-fail-reason="assetMainFileFailReason"
        />
        <template v-if="simpleMode">
          <div class="py-2">
            <AssetDetailSidebarMetadata
              :queue-key="queueKey"
              :ext-system="extSystem"
              :config-name="configName"
              :is-active="true"
              :asset-type="assetType"
            />
          </div>
          <div class="py-2">
            <AssetDetailSidebarROI
              :is-active="true"
              :queue-key="queueKey"
            />
          </div>
        </template>
        <template v-else>
          <div
            v-if="activeTab === AssetDetailTabImageWithRoi.Info"
            class="py-2"
          >
            <AssetDetailSidebarMetadata
              :queue-key="queueKey"
              :ext-system="extSystem"
              :config-name="configName"
              :is-active="activeTab === AssetDetailTabImageWithRoi.Info"
              :asset-type="assetType"
            />
          </div>
          <div
            v-if="isImage && activeTab === AssetDetailTabImageWithRoi.ROI"
            class="py-2"
          >
            <AssetDetailSidebarROI
              :is-active="activeTab === AssetDetailTabImageWithRoi.ROI"
              :queue-key="queueKey"
            />
          </div>
        </template>
      </div>
      <div class="sidebar-info__actions px-2">
        <AssetDetailSidebarActionsTeleportTarget :queue-key="queueKey" />
      </div>
    </div>
  </div>
</template>
