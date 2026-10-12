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
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
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

const queueTotalCount = computed(() => {
  return uploadQueuesStore.getQueueTotalCount(props.queueKey)
})

const queueProcessedCount = computed(() => {
  return uploadQueuesStore.getQueueProcessedCount(props.queueKey)
})

const isUploading = computed(() => {
  return queueTotalCount.value > queueProcessedCount.value
})

// The item's own switch: the store loads it with the item's metadata and leaves it to the user after that (a
// duplicate takes over the original's). Not the asset detail's, which is set anew from the server when the item
// turns uploaded, over what the user had chosen while the file was still on its way.
const mainFileSingleUse = computed(() => item.value?.mainFileSingleUse ?? false)

// What the original of a duplicate is, as it was found: the notice is about that asset, and does not follow the
// switch, which is the item's value from then on.
const originalIsSingleUse = ref(false)
watch(
  () => item.value?.isDuplicate,
  (isDuplicate) => {
    originalIsSingleUse.value = !!isDuplicate && item.value?.mainFileSingleUse === true
  },
  { immediate: true }
)

// Which of the two buttons saves, while it does: the other one waits, and neither sends a second request.
const saving = ref<'save' | 'saveAndApply' | null>(null)

const onSave = async () => {
  if (items.value.length === 0 || !isNull(saving.value)) return
  saving.value = 'save'
  try {
    await bulkUpdateAssetsMetadata(damClient, endPointAsset, items.value, mainFileSingleUse.value)
    showRecordWas('updated')
  } catch (error) {
    showMetadataSaveError(error, props.extSystem)
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
      showMetadataSaveError(error, props.extSystem)
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
    // The save is said above. What follows it, the images made of its answer, is said as it was before.
    showErrorsDefault(error)
  } finally {
    saving.value = null
  }
}

watch(
  isDone,
  async (newValue) => {
    if (!newValue || !item.value?.assetId) return
    const assetId = item.value.assetId
    try {
      const res = await fetchAsset(damClient, endPointAsset, assetId)
      // Closed meanwhile, the dialog has emptied its queue. The detail store is shared: written now, the asset of
      // this file would be what the next dialog shows.
      if (item.value?.assetId !== assetId) return
      assetDetailStore.setAsset(res)
      enableRoiTab.value = true
    } catch (e) {
      // Closed meanwhile as well: the error would be shown over whatever the user has gone on to.
      if (item.value?.assetId !== assetId) return
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
        class="text-label-large text-green-darken-3 font-weight-bold"
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
