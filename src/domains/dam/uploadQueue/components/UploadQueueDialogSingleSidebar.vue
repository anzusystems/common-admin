<script setup lang="ts">
import type { DocId, IntegerId } from '@/shared/types/common'
import type { DamAssetStatusType, DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { AssetFileFailReasonType, AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'
import { computed, onUnmounted, ref, watch } from 'vue'
import AssetDetailSidebarFrame from '@/domains/dam/assetDetail/components/AssetDetailSidebarFrame.vue'
import UploadQueueDialogSingleSidebarMetadata from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebarMetadata.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import {
  SHOW_REFRESH_AFTER_SECONDS,
  useUploadQueueItemRefresh,
} from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { isNull } from '@/shared/utils/common'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

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
    /** Which of the two buttons of the metadata saves, while it does. */
    saving?: 'save' | 'saveAndApply' | null
  }>(),
  {
    assetMainFileStatus: undefined,
    assetMainFileFailReason: undefined,
    dataCy: undefined,
    configName: undefined,
    saving: null,
  }
)
const emit = defineEmits<{
  (e: 'save'): void
  (e: 'saveAndApply'): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { simpleAssetSidebarEnabled } = useCommonAdminCoreDamOptions(damConfigName)
const simpleMode = computed(() => simpleAssetSidebarEnabled && props.isImage && props.enableRoiTab)

// What the item still waits for from the server: its file to be processed, or, uploaded, its metadata. Until
// then its form stays disabled, and both saves with it. Each wait is counted from its start, as the row of the
// queue counts it. Here, not in the metadata tab: the wait goes on while the other tab is open.
const uploadQueuesStore = useUploadQueuesStore()
const item = computed(() => uploadQueuesStore.getQueueItems(props.queueKey)[0] ?? null)
const waitsFor = computed(() => {
  if (item.value?.status === UploadQueueItemStatus.Processing) return 'file'
  if (item.value?.status === UploadQueueItemStatus.Uploaded && !item.value.canEditMetadata) return 'metadata'
  return null
})
const refreshDue = ref(false)
let refreshTimer: ReturnType<typeof setTimeout> | undefined
watch(
  waitsFor,
  (waits) => {
    clearTimeout(refreshTimer)
    refreshDue.value = false
    if (isNull(waits)) return
    refreshTimer = setTimeout(() => (refreshDue.value = true), SHOW_REFRESH_AFTER_SECONDS * 1000)
  },
  { immediate: true }
)
onUnmounted(() => clearTimeout(refreshTimer))
// A failed item offers refresh, as the row of the queue does, while one may still change it: the store says so, and
// the item has its asset.
const showRefresh = computed(() => {
  if (item.value?.status === UploadQueueItemStatus.Failed) {
    return uploadQueuesStore.refreshMayHelp(item.value) && !isNull(item.value.assetId)
  }
  return refreshDue.value
})

const { refreshing, refreshItem } = useUploadQueueItemRefresh(damConfigName)
const refresh = () => {
  if (item.value?.assetId) refreshItem(item.value.assetId, item.value, props.queueKey)
}
</script>

<template>
  <AssetDetailSidebarFrame
    :queue-key="queueKey"
    :config-name="damConfigName"
    :roi-tab="isImage && enableRoiTab"
    :simple-mode="simpleMode"
  >
    <template #prepend>
      <slot name="prepend-sidebar" />
    </template>
    <template #info="{ isActive }">
      <UploadQueueDialogSingleSidebarMetadata
        :queue-key="queueKey"
        :ext-system="extSystem"
        :config-name="damConfigName"
        :is-active="isActive"
        :asset-type="assetType"
        :show-refresh="showRefresh"
        :refresh-disabled="refreshing"
        :saving="saving"
        @refresh="refresh"
        @save="emit('save')"
        @save-and-apply="emit('saveAndApply')"
      />
    </template>
  </AssetDetailSidebarFrame>
</template>
