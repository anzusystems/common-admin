<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/themeSettings'
import {
  AssetDetailTabImageWithRoi,
  useAssetDetailStore,
} from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import {
  type AssetDetailItemDto,
  DamAssetStatusDefault,
  DamAssetType,
  DamAssetTypeDefault,
} from '@/types/coreDam/Asset'
import AssetDetailDialogLoader from '@/components/damImage/uploadQueue/components/AssetDetailDialogLoader.vue'
import AssetImage from '@/components/damImage/uploadQueue/components/AssetImage.vue'
import { AssetFileFailReason, assetFileIsImageFile } from '@/types/coreDam/AssetFile'
import DamAssetImageRoiSelect from '@/components/damImage/uploadQueue/components/DamAssetImageRoiSelect.vue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
} from '@/types/coreDam/UploadQueue'
import { dateTimeNow } from '@/utils/datetime'
import AssetFileFailReasonChip from '@/components/damImage/uploadQueue/components/AssetFileFailReasonChip.vue'
import { useAlerts } from '@/composables/system/alerts'
import {
  bulkUpdateAssetsMetadata,
  fetchAsset,
} from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingleSidebar from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingleSidebar.vue'
import UploadQueueButtonStop from '@/components/damImage/uploadQueue/components/UploadQueueButtonStop.vue'
import { isNull } from '@/utils/common'
import { mapUploadMetadataToImages } from '@/components/damImage/uploadQueue/composables/metadataToImageMap'
import type { IntegerId } from '@/types/common'

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
    configName: 'default',
    disableDoneAnimation: false,
  },
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
    mainFileSingleUse: false,
    mainFileInternal: item.value.mainFileInternal ?? null,
    mainFileOverrideInternal: null,
    flags: {
      described: false,
      visible: false,
    },
    siblingToAsset: null,
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

const assetType = computed(() => {
  return asset.value?.attributes.assetType || DamAssetTypeDefault
})

const assetStatus = computed(() => {
  if (!asset.value) return DamAssetStatusDefault
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

const processingStatuses: readonly UploadQueueItemStatusType[] = [
  UploadQueueItemStatus.Processing,
  UploadQueueItemStatus.Loading,
]
const processing = computed(() => {
  return !isNull(item.value) && processingStatuses.includes(item.value.status)
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

const {
  damClient,
  endPointAsset,
  customUploadMetadataToImageMap,
  simpleAssetSidebarEnabled,
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
} = useCommonAdminCoreDamOptions(props.configName)
const simpleMode = computed(
  () => simpleAssetSidebarEnabled && isTypeImage.value && enableRoiTab.value,
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

const onSave = async () => {
  if (items.value.length === 0) return
  try {
    await bulkUpdateAssetsMetadata(
      damClient,
      endPointAsset,
      items.value,
      assetDetailStore.mainFileSingleUse,
    )
    showRecordWas('updated')
  } catch (error) {
    showErrorsDefault(error)
  }
}

const onSaveAndApply = async () => {
  if (items.value.length === 0) return
  try {
    const assetsMetadataRes = await bulkUpdateAssetsMetadata(
      damClient,
      endPointAsset,
      items.value,
      assetDetailStore.mainFileSingleUse,
    )
    if (!assetsMetadataRes[0]) {
      throw new Error('Fatal error updating asset metadata')
    }
    showRecordWas('updated')
    const mappedItems = customUploadMetadataToImageMap
      ? await customUploadMetadataToImageMap(
          items.value,
          assetsMetadataRes,
          damClient,
          props.extSystem,
          props.licenceId,
        )
      : await mapUploadMetadataToImages(
          items.value,
          assetsMetadataRes,
          damClient,
          props.extSystem,
          props.licenceId,
        )
    emit(
      'onApply',
      mappedItems.map((item) => ({
        ...item,
        position: 1,
      })),
    )
    await onStopConfirm()
  } catch (error) {
    showErrorsDefault(error)
  }
}

watch(
  isDone,
  async (newValue) => {
    if (!newValue || !item.value?.assetId) return
    try {
      const res = await fetchAsset(damClient, endPointAsset, item.value.assetId)
      assetDetailStore.setAsset(res)
      enableRoiTab.value = true
    } catch (e) {
      showErrorsDefault(e)
    }
  },
  { immediate: true },
)

onMounted(() => {
  activeTab.value = AssetDetailTabImageWithRoi.Info
})
</script>

<template>
  <VDialog
    :model-value="true"
    fullscreen
    eager
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
          <div class="text-label-large d-flex px-2">
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
              <VIcon
                icon="mdi-information-outline"
                class="d-none d-md-flex"
              />
              <VIcon
                icon="mdi-image-outline"
                class="d-flex d-md-none"
              />
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
        <div class="d-flex w-100 h-100 position-relative dam-image-detail__content">
          <div class="d-flex w-100 align-center dam-image-detail__left">
            <div
              v-if="(activeTab === AssetDetailTabImageWithRoi.ROI && enableRoiTab) || simpleMode"
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <DamAssetImageRoiSelect
                :ext-system="extSystem"
                :config-name="configName"
              />
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
                  :aspect-ratio="IMAGE_ASPECT_RATIO"
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
                    class="text-body-small"
                    v-text="item.error.message"
                  />
                  <div v-else-if="item.error.assetFileFailReason !== AssetFileFailReason.None">
                    <AssetFileFailReasonChip :reason="item.error.assetFileFailReason" />
                  </div>
                  <div
                    v-else
                    class="text-body-small"
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
              :config-name="configName"
              :enable-roi-tab="enableRoiTab"
              :show-file-info="enableRoiTab"
              :asset-id="asset.id"
              :is-video="isTypeVideo"
              :is-audio="isTypeAudio"
              :is-image="isTypeImage"
              :is-document="isTypeDocument"
              :asset-status="assetStatus"
              :asset-type="assetType"
              :asset-main-file-status="
                assetMainFile ? assetMainFile.fileAttributes.status : undefined
              "
              :asset-main-file-fail-reason="
                assetMainFile ? assetMainFile.fileAttributes.failReason : undefined
              "
              @on-save="onSave"
              @on-save-and-apply="onSaveAndApply"
            >
              <template #prepend-sidebar>
                <div
                  v-if="item?.isDuplicate"
                  class="text-body-small text-warning px-3 py-2"
                >
                  {{ t('common.damImage.asset.detail.info.status.duplicate') }}
                </div>
                <div
                  v-if="item?.isDuplicate && item?.mainFileSingleUse"
                  class="text-body-small text-error px-3 py-2"
                >
                  {{ t('common.damImage.asset.model.mainFileSingleUse') }}
                </div>
              </template>
            </UploadQueueDialogSingleSidebar>
          </div>
        </div>
      </div>
    </VCard>
  </VDialog>
</template>
