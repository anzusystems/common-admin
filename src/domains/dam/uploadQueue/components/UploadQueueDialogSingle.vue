<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import AssetDetailDialogFrame from '@/domains/dam/assetDetail/components/AssetDetailDialogFrame.vue'
import { assetDetailViewOfUploadItem } from '@/domains/dam/assetDetail/composables/assetDetailView'
import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import {
  useUploadQueueDialog,
  useUploadQueueDialogDrawn,
} from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueItemErrorOverlay from '@/domains/dam/uploadQueue/components/UploadQueueItemErrorOverlay.vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import {
  type AssetMetadataBulkItem,
  bulkUpdateAssetsMetadata,
  fetchAsset,
  showMetadataSaveError,
} from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingleSidebar from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingleSidebar.vue'
import UploadQueueButtonStop from '@/domains/dam/uploadQueue/components/UploadQueueButtonStop.vue'
import { isNull } from '@/shared/utils/common'
import { mapUploadMetadataToImages } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import type { IntegerId } from '@/shared/types/common'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    licenceId: IntegerId
    fileInputKey: number
    accept: string | undefined
    maxSizes: Record<string, number> | undefined
    configName?: string
    disableDoneAnimation?: boolean
  }>(),
  {
    configName: undefined,
    disableDoneAnimation: false,
  }
)

const emit = defineEmits<{
  (e: 'apply', items: ImageCreateUpdateAware[]): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { showErrorsDefault, showRecordWas } = useAlerts()

const { t } = useI18n()

const assetDetailStore = useAssetDetailStore()
const { activeTab, loading, asset: assetDetail } = storeToRefs(assetDetailStore)
const enableRoiTab = ref(false)

const uploadQueuesStore = useUploadQueuesStore()
const { uploadQueueDialog } = useUploadQueueDialog()

const items = computed(() => {
  return uploadQueuesStore.getQueueItems(props.queueKey)
})

const item = computed<UploadQueueItem | null>(() => {
  return items.value[0] ?? null
})

const isDone = computed(() => {
  return !isNull(item.value) && item.value.status === UploadQueueItemStatus.Uploaded
})

// The title stays "done", in the error colour for a refused or failed file.
const isFailed = computed(() => item.value?.status === UploadQueueItemStatus.Failed)

const { damClient, endPointAsset, endPointAuthor, customUploadMetadataToImageMap, simpleAssetSidebarEnabled } =
  useCommonAdminCoreDamOptions(damConfigName)

const view = computed(() =>
  assetDetailViewOfUploadItem(item.value, assetDetail.value, {
    enableRoiTab: enableRoiTab.value,
    disableDoneAnimation: props.disableDoneAnimation,
    simpleAssetSidebarEnabled,
  })
)

const onStopConfirm = async () => {
  uploadQueuesStore.stopUpload(props.queueKey)
  assetDetailStore.setAsset(null)
  uploadQueueDialog.value = null
}
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
useUploadQueueDialogDrawn(props.queueKey)

const queueTotalCount = computed(() => {
  return uploadQueuesStore.getQueueTotalCount(props.queueKey)
})

const queueProcessedCount = computed(() => {
  return uploadQueuesStore.getQueueProcessedCount(props.queueKey)
})

const isUploading = computed(() => {
  return queueTotalCount.value > queueProcessedCount.value
})

// The item's own switch. The store loads it with the item's metadata,
// then the user owns it. A duplicate takes the original's value.
// Not the asset detail's value: that is reset from the server when the
// item turns uploaded, overwriting the user's choice made during upload.
const mainFileSingleUse = computed(() => item.value?.mainFileSingleUse ?? false)

// Whether the duplicate's original is single use, as found. The notice is about that
// asset and does not follow the switch, which is the item's value from then on.
const originalIsSingleUse = ref(false)
watch(
  () => item.value?.isDuplicate,
  (isDuplicate) => {
    originalIsSingleUse.value = !!isDuplicate && item.value?.mainFileSingleUse === true
  },
  { immediate: true }
)

// Which button is saving. The other one waits, so no second request is sent.
const saving = ref<'save' | 'saveAndApply' | null>(null)

const onSave = async () => {
  if (items.value.length === 0 || !isNull(saving.value)) return
  saving.value = 'save'
  try {
    await bulkUpdateAssetsMetadata(damClient, endPointAsset, items.value, mainFileSingleUse.value)
    showRecordWas('updated')
  } catch (error) {
    showMetadataSaveError(error, props.extSystem, damConfigName)
  } finally {
    saving.value = null
  }
}

const onSaveAndApply = async () => {
  if (items.value.length === 0 || !isNull(saving.value)) return
  saving.value = 'saveAndApply'
  try {
    let assetsMetadataRes: AssetMetadataBulkItem[]
    try {
      assetsMetadataRes = await bulkUpdateAssetsMetadata(damClient, endPointAsset, items.value, mainFileSingleUse.value)
      if (!assetsMetadataRes[0]) {
        throw new Error('Fatal error updating asset metadata')
      }
    } catch (error) {
      showMetadataSaveError(error, props.extSystem, damConfigName)
      return
    }
    showRecordWas('updated')
    const mappedItems = customUploadMetadataToImageMap
      ? await customUploadMetadataToImageMap(
          items.value,
          assetsMetadataRes,
          damClient,
          props.extSystem,
          props.licenceId
        )
      : await mapUploadMetadataToImages(
          items.value,
          assetsMetadataRes,
          damClient,
          props.extSystem,
          props.licenceId,
          endPointAuthor
        )
    emit(
      'apply',
      mappedItems.map((item) => ({
        ...item,
        position: 1,
      }))
    )
    await onStopConfirm()
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    saving.value = null
  }
}

// Read when the file is done and again when the row gets another asset.
// A duplicate row becomes the original only after the original asset was read, so the first read showed no "File info".
watch(
  [isDone, () => item.value?.assetId],
  async ([done, assetId]) => {
    if (!done || !assetId) return
    // Capture the row being read. A dialog closed meanwhile empties its
    // queue, and the widget's next upload is a new row in the same queue.
    const row = item.value
    try {
      const res = await fetchAsset(damClient, endPointAsset, assetId)
      // If the dialog closed meanwhile, its queue is emptied. The detail store
      // is shared, so writing now would show this asset in the next dialog.
      // The same applies to a row that has another asset by now.
      if (item.value?.assetId !== assetId) return
      assetDetailStore.setAsset(res)
      enableRoiTab.value = true
    } catch (e) {
      // Skip the error if the dialog closed meanwhile. It would appear
      // over whatever the user moved on to, such as the next upload.
      // A row that became the original of a duplicate is the same row, so its failed read is reported normally.
      if (item.value !== row) return
      showErrorsDefault(e)
    }
  },
  { immediate: true }
)

onMounted(() => {
  activeTab.value = AssetDetailTabImageWithRoi.Info
})
</script>

<template>
  <AssetDetailDialogFrame
    :loading="loading || !item"
    :view="view"
    :ext-system="extSystem"
    :config-name="damConfigName"
    @close="onStopConfirm"
  >
    <template #title>
      <div
        v-if="isUploading"
        class="text-label-large"
      >
        {{ t('common.damImage.upload.title') }}
      </div>
      <div
        v-else
        class="text-label-large font-weight-bold"
        :class="isFailed ? 'text-error' : 'text-green-darken-3'"
      >
        {{ t('common.damImage.upload.titleDone') }}
      </div>
    </template>
    <template #toolbar-actions>
      <UploadQueueButtonStop
        data-cy="button-close"
        :button-size="36"
        :is-uploading="isUploading"
        @confirm="onStopConfirm"
      />
    </template>
    <template #image-overlay>
      <UploadQueueItemErrorOverlay
        v-if="item && item.error.hasError"
        :error="item.error"
      />
    </template>
    <template #sidebar="{ view: shown }">
      <UploadQueueDialogSingleSidebar
        v-if="shown.id"
        :key="shown.id"
        :queue-key="queueKey"
        :ext-system="extSystem"
        :config-name="damConfigName"
        :enable-roi-tab="enableRoiTab"
        :show-file-info="enableRoiTab"
        :asset-id="shown.id"
        :is-video="shown.assetType === DamAssetType.Video"
        :is-audio="shown.assetType === DamAssetType.Audio"
        :is-image="shown.assetType === DamAssetType.Image"
        :is-document="shown.assetType === DamAssetType.Document"
        :asset-status="shown.assetStatus"
        :asset-type="shown.assetType"
        :asset-main-file-status="shown.mainFile ? shown.mainFile.fileAttributes.status : undefined"
        :asset-main-file-fail-reason="shown.mainFile ? shown.mainFile.fileAttributes.failReason : undefined"
        :saving="saving"
        @save="onSave"
        @save-and-apply="onSaveAndApply"
      >
        <template #prepend-sidebar>
          <div
            v-if="item?.isDuplicate"
            class="text-body-small text-warning px-3 py-2"
          >
            {{ t('common.damImage.asset.detail.info.status.duplicate') }}
          </div>
          <div
            v-if="item?.isDuplicate && originalIsSingleUse"
            class="text-body-small text-error px-3 py-2"
          >
            {{ t('common.damImage.asset.model.mainFileSingleUse') }}
          </div>
        </template>
      </UploadQueueDialogSingleSidebar>
    </template>
  </AssetDetailDialogFrame>
</template>
