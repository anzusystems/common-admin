<script setup lang="ts">
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { DamAssetStatusType, DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { AssetFileFailReasonType, AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AssetDetailSidebarROI from '@/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue'
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import UploadQueueDialogSingleSidebarMetadata from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebarMetadata.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import {
  SHOW_REFRESH_AFTER_SECONDS,
  useUploadQueueItemRefresh,
} from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    assetId: DocId
    isVideo: boolean
    isAudio: boolean
    isImage: boolean
    isDocument: boolean
    enableRoiTab: boolean
    showFileInfo: boolean
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
const emit = defineEmits<{
  (e: 'save'): void
  (e: 'saveAndApply'): void
}>()

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { activeTab } = storeToRefs(assetDetailStore)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(props.configName)
const simpleMode = computed(() => simpleAssetSidebarEnabled && props.isImage && props.enableRoiTab)

// An uploaded item whose metadata has not come: its form stays disabled, and both saves with it. Here, not in the
// metadata tab: the wait goes on while the other tab is open.
const uploadQueuesStore = useUploadQueuesStore()
const item = computed(() => uploadQueuesStore.getQueueItems(props.queueKey)[0] ?? null)
const waitsForMetadata = computed(
  () => item.value?.status === UploadQueueItemStatus.Uploaded && !item.value.canEditMetadata
)
const showRefresh = ref(false)
let refreshTimer: ReturnType<typeof setTimeout> | undefined
watch(
  waitsForMetadata,
  (waits) => {
    clearTimeout(refreshTimer)
    showRefresh.value = false
    if (!waits) return
    refreshTimer = setTimeout(() => (showRefresh.value = true), SHOW_REFRESH_AFTER_SECONDS * 1000)
  },
  { immediate: true }
)
onUnmounted(() => clearTimeout(refreshTimer))

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { refreshing, refreshItem } = useUploadQueueItemRefresh(props.configName)
const refresh = () => {
  if (item.value?.assetId) refreshItem(item.value.assetId)
}
</script>

<template>
  <div
    class="sidebar-info d-flex w-100 h-100 flex-column"
    :class="{ 'sidebar-info--no-tabs': simpleMode }"
  >
    <div class="w-100 h-100 d-flex flex-column">
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
          v-if="isImage && enableRoiTab"
          :value="AssetDetailTabImageWithRoi.ROI"
          data-cy="button-focus"
        >
          {{ t('common.damImage.asset.detail.tabs.roi') }}
        </VTab>
      </VTabs>

      <div class="sidebar-info__content">
        <slot name="prepend-sidebar" />
        <template v-if="simpleMode">
          <div class="py-2">
            <UploadQueueDialogSingleSidebarMetadata
              :queue-key="queueKey"
              :ext-system="extSystem"
              :config-name="configName"
              :is-active="true"
              :asset-type="assetType"
              :show-refresh="showRefresh"
              :refresh-disabled="refreshing"
              @refresh="refresh"
              @save="emit('save')"
              @save-and-apply="emit('saveAndApply')"
            />
          </div>
          <div class="py-2">
            <AssetDetailSidebarROI
              :queue-key="queueKey"
              :is-active="true"
              :config-name="configName"
            />
          </div>
        </template>
        <template v-else>
          <div
            v-if="activeTab === AssetDetailTabImageWithRoi.Info"
            class="py-2"
          >
            <UploadQueueDialogSingleSidebarMetadata
              :queue-key="queueKey"
              :ext-system="extSystem"
              :config-name="configName"
              :is-active="activeTab === AssetDetailTabImageWithRoi.Info"
              :asset-type="assetType"
              :show-refresh="showRefresh"
              :refresh-disabled="refreshing"
              @refresh="refresh"
              @save="emit('save')"
              @save-and-apply="emit('saveAndApply')"
            />
          </div>
          <div
            v-if="isImage && activeTab === AssetDetailTabImageWithRoi.ROI"
            class="py-2"
          >
            <AssetDetailSidebarROI
              :queue-key="queueKey"
              :is-active="activeTab === AssetDetailTabImageWithRoi.ROI"
              :config-name="configName"
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
