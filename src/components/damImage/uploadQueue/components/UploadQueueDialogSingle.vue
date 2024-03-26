<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/themeSettings'
import {
  AssetDetailTabImageWithRoi,
  useAssetDetailStore,
} from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { type AssetDetailItemDto, DamAssetStatus, DamAssetType } from '@/types/coreDam/Asset'
import AssetDetailDialogLoader from '@/components/damImage/uploadQueue/components/AssetDetailDialogLoader.vue'
import AssetImage from '@/components/damImage/uploadQueue/components/AssetImage.vue'
import { AssetFileFailReason, assetFileIsImageFile } from '@/types/coreDam/AssetFile'
import AssetImageRoiSelect from '@/components/damImage/uploadQueue/components/AssetImageRoiSelect.vue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/types/coreDam/UploadQueue'
import { dateTimeNow } from '@/utils/datetime'
import AssetFileFailReasonChip from '@/components/damImage/uploadQueue/components/AssetFileFailReasonChip.vue'
import { useAlerts } from '@/composables/system/alerts'
import { bulkUpdateAssetsMetadata, fetchAsset } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingleSidebar from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingleSidebar.vue'
import UploadQueueButtonStop from '@/components/damImage/uploadQueue/components/UploadQueueButtonStop.vue'
import { isNull, isString } from '@/utils/common'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    licenceId: IntegerId
    fileInputKey: number
    accept: string | undefined
    maxSizes: Record<string, number> | undefined
    disableDoneAnimation?: boolean
  }>(),
  {
    disableDoneAnimation: false,
  }
)

const emit = defineEmits<{
  (e: 'onApply', items: ImageCreateUpdateAware[]): void
}>()

const { showErrorsDefault, showRecordWas } = useAlerts()

const IMAGE_ASPECT_RATIO = 16 / 9

const { t } = useI18n()

const { toolbarColor } = useTheme()

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

const asset = computed<AssetDetailItemDto | null>(() => {
  if (!item.value || !item.value.assetId) return null
  if (isDone.value && assetDetail.value) return assetDetail.value
  return {
    id: item.value.assetId,
    texts: {
      displayTitle: '',
    },
    attributes: {
      assetType: item.value.assetType,
      assetStatus: item.value.assetStatus,
    },
    flags: {
      described: false,
      visible: false,
    },
    licence: item.value.licenceId,
    mainFile: null,
    keywords: [],
    authors: [],
    podcasts: [],
    metadata: {
      authorSuggestions: {},
      keywordSuggestions: {},
      customData: {},
    },
    distributionCategory: null,
    assetFileProperties: {
      distributesInServices: [],
      slotNames: [],
      fromRss: false,
      width: 0,
      height: 0,
    },
    _resourceName: 'asset',
    _system: 'coreDam',
    createdAt: dateTimeNow(),
    modifiedAt: dateTimeNow(),
    createdBy: null,
    modifiedBy: null,
  }
})

const sidebar = ref(true)

const toggleSidebar = () => {
  sidebar.value = !sidebar.value
}

const onImageLoad = () => {
  // imageLoading.value = false
}

const assetType = computed(() => {
  return asset.value?.attributes.assetType || DamAssetType.Default
})

const assetStatus = computed(() => {
  if (!asset.value) return DamAssetStatus.Default
  return asset.value.attributes.assetStatus
})

const isTypeImage = computed(() => {
  return assetType.value === DamAssetType.Image
})
const isTypeVideo = computed(() => {
  return assetType.value === DamAssetType.Video
})
const isTypeAudio = computed(() => {
  return assetType.value === DamAssetType.Audio
})
const isTypeDocument = computed(() => {
  return assetType.value === DamAssetType.Document
})

const imageProperties = computed(() => {
  if (item.value?.imagePreview) {
    return {
      url: item.value.imagePreview.url,
      width: item.value.imagePreview.requestedWidth || undefined,
      height: item.value.imagePreview.requestedHeight || undefined,
      bgColor:
        assetFileIsImageFile(asset.value?.mainFile) &&
        asset.value?.mainFile.imageAttributes &&
        asset.value?.mainFile.imageAttributes.mostDominantColor
          ? asset.value.mainFile.imageAttributes.mostDominantColor
          : '#ccc',
    }
  }
  return {
    url: '',
    width: 356,
    height: 200,
    bgColor: '#ccc',
  }
})

const assetMainFile = computed(() => {
  return asset.value?.mainFile || undefined
})

const processing = computed(() => {
  return (
    !isNull(item.value) && [UploadQueueItemStatus.Processing, UploadQueueItemStatus.Loading].includes(item.value.status)
  )
})
const waiting = computed(() => {
  return !isNull(item.value) && item.value.status === UploadQueueItemStatus.Waiting
})
const isDone = computed(() => {
  return !isNull(item.value) && item.value.status === UploadQueueItemStatus.Uploaded
})
const showDone = computed(() => {
  return !props.disableDoneAnimation && isDone.value
})
const uploading = computed(() => {
  return !isNull(item.value) && item.value.status === UploadQueueItemStatus.Uploading
})
const uploadProgress = computed(() => {
  return item.value?.progress.progressPercent
})

const { damClient } = useCommonAdminCoreDamOptions()

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

const onSave = async () => {
  if (items.value.length === 0) return
  // saveAndCloseButtonLoading.value = true
  // v$.value.$touch()
  // if (v$.value.$invalid) {
  //   showValidationError()
  //   saveAndCloseButtonLoading.value = false
  //   return
  // }
  try {
    await bulkUpdateAssetsMetadata(damClient, items.value)
    showRecordWas('updated')
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    // saveAndCloseButtonLoading.value = false
  }
}

const onSaveAndApply = async () => {
  if (items.value.length === 0) return
  // saveAndCloseButtonLoading.value = true
  // v$.value.$touch()
  // if (v$.value.$invalid) {
  //   showValidationError()
  //   saveAndCloseButtonLoading.value = false
  //   return
  // }
  let description = ''
  let source = ''
  try {
    const assetsMetadataRes = await bulkUpdateAssetsMetadata(damClient, items.value)
    if (!assetsMetadataRes[0]) {
      throw new Error('Fatal error updating asset metadata')
    }
    showRecordWas('updated')
    if (isString(assetsMetadataRes[0].customData?.description)) {
      description = assetsMetadataRes[0].customData.description.trim()
    }
    if (assetsMetadataRes[0].authors.length > 0) {
      const authorsRes = await fetchAuthorListByIds(damClient, props.extSystem, assetsMetadataRes[0].authors)
      source = authorsRes.map((author) => author.name).join(', ')
    }
    emit(
      'onApply',
      items.value.map((item) => {
        return {
          texts: {
            description: description,
            source: source,
          },
          dam: {
            damId: item.fileId ?? '',
            regionPosition: 0,
            licenceId: props.licenceId,
          },
          position: 1,
        }
      })
    )

    await onStopConfirm()
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    // saveAndCloseButtonLoading.value = false
  }
}

watch(
  isDone,
  async (newValue) => {
    if (!newValue || !item.value?.assetId) return
    try {
      const res = await fetchAsset(damClient, item.value.assetId)
      assetDetailStore.setAsset(res)
      enableRoiTab.value = true
    } catch (e) {
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
  <VDialog
    :model-value="true"
    fullscreen
  >
    <AssetDetailDialogLoader
      v-if="loading || !item"
      @close-dialog="onStopConfirm"
    />
    <VCard
      v-else-if="item"
      class="dam-image-detail"
      :class="{ 'dam-image-detail--sidebar-active': sidebar }"
    >
      <div class="dam-image-detail__wrapper d-flex flex-column">
        <VToolbar
          :color="toolbarColor"
          density="compact"
          :height="64"
          class="system-border-b pr-1"
        >
          <div class="text-subtitle-2 d-flex px-2">
            <div
              v-if="isUploading"
              class="text-subtitle-2"
            >
              {{ t('common.damImage.upload.title') }}
            </div>
            <div
              v-else
              class="text-subtitle-2 text-green-darken-3 font-weight-bold"
            >
              {{ t('common.damImage.upload.titleDone') }}
            </div>
          </div>
          <VSpacer />
          <div class="pr-3">
            <VBtn
              :active="sidebar"
              :variant="sidebar ? 'flat' : 'text'"
              :color="sidebar ? 'secondary' : ''"
              icon
              class="mr-1"
              :width="36"
              :height="36"
              @click.stop="toggleSidebar"
            >
              <VIcon icon="mdi-information-outline" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.damImage.asset.detail.toggleInfo') }}
              </VTooltip>
            </VBtn>
            <UploadQueueButtonStop
              data-cy="button-close"
              :button-size="36"
              :is-uploading="isUploading"
              @confirm="onStopConfirm"
            />
          </div>
        </VToolbar>
        <div class="d-flex w-100 h-100 position-relative">
          <div class="d-flex w-100 align-center dam-image-detail__left">
            <div
              v-if="activeTab === AssetDetailTabImageWithRoi.ROI && enableRoiTab"
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <AssetImageRoiSelect />
            </div>
            <div
              v-else
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <div class="position-relative">
                <AssetImage
                  v-if="item"
                  :asset-type="assetType"
                  :asset-status="assetStatus"
                  :src="imageProperties.url"
                  :background-color="imageProperties.bgColor"
                  :width="imageProperties.width"
                  :height="imageProperties.height"
                  :show-uploading="uploading"
                  :show-processing="processing"
                  :show-waiting="waiting"
                  :show-done="showDone"
                  :uploading-progress="uploadProgress"
                  :remaining-time="item.progress.remainingTime"
                  use-component
                  cover
                  :aspect-ratio="IMAGE_ASPECT_RATIO"
                  @load="onImageLoad"
                  @error="onImageLoad"
                />
                <div
                  v-if="item && item.error.hasError"
                  :class="
                    'dam-upload-queue__overlay dam-upload-queue__overlay--error ' +
                      'd-flex align-center justify-center flex-column'
                  "
                >
                  <VIcon
                    icon="mdi-alert"
                    class="ma-1"
                    size="x-small"
                    color="error"
                  />
                  <div class="text-error">
                    {{ t('common.damImage.queueItem.error') }}
                  </div>
                  <div
                    v-if="item && item.error.message.length"
                    class="text-caption"
                    v-text="item.error.message"
                  />
                  <div v-else-if="item.error.assetFileFailReason !== AssetFileFailReason.None">
                    <AssetFileFailReasonChip :reason="item.error.assetFileFailReason" />
                  </div>
                  <div
                    v-else
                    class="text-caption"
                  >
                    {{ t('common.damImage.uploadErrors.unknownError') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="h-100 d-flex dam-image-detail__sidebar system-border-l">
            <UploadQueueDialogSingleSidebar
              v-if="asset"
              :key="asset.id"
              :queue-key="queueKey"
              :ext-system="extSystem"
              :enable-roi-tab="enableRoiTab"
              :show-file-info="enableRoiTab"
              :asset-id="asset.id"
              :is-video="isTypeVideo"
              :is-audio="isTypeAudio"
              :is-image="isTypeImage"
              :is-document="isTypeDocument"
              :asset-status="assetStatus"
              :asset-type="assetType"
              :asset-main-file-status="assetMainFile ? assetMainFile.fileAttributes.status : undefined"
              :asset-main-file-fail-reason="assetMainFile ? assetMainFile.fileAttributes.failReason : undefined"
              @on-save="onSave"
              @on-save-and-apply="onSaveAndApply"
            />
          </div>
        </div>
      </div>
    </VCard>
  </VDialog>
</template>
