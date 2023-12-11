<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { cloneDeep, isNull, isString, isUndefined } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import { DamAssetType } from '@/types/coreDam/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import AFileInput from '@/components/file/AFileInput.vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import type { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import { createImage, deleteImage, fetchImage, updateImage } from '@/components/damImage/uploadQueue/api/imageApi'
import ImageDetailDialogMetadata from '@/components/damImage/uploadQueue/components/ImageDetailDialogMetadata.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed, inject, ref, type ShallowRef, toRaw, watch } from 'vue'
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import { fetchAsset, fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingle from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useI18n } from 'vue-i18n'
import type { VBtn } from 'vuetify/components'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    disableOnClickMenu?: boolean
    width?: number | undefined
    callDeleteApiOnRemove?: boolean
  }>(),
  {
    configName: 'default',
    label: undefined,
    image: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    expandOptions: false,
    disableOnClickMenu: false,
    width: undefined,
    callDeleteApiOnRemove: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerIdNullable): void
}>()

const imageWidgetExtSystemConfig = inject<ShallowRef<DamExtSystemConfig> | undefined>(
  ImageWidgetExtSystemConfig,
  undefined
)

if (isUndefined(imageWidgetExtSystemConfig)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

const { t } = useI18n()

const { showErrorsDefault } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()
const imageStore = useImageStore()
const { uploadQueueDialog } = useUploadQueueDialog()

const resImage = ref<null | ImageAware>(null)
const clickMenuOpened = ref(false)
const assetSelectDialog = ref(false)
const metadataDialog = ref(false)
const metadataDialogSaving = ref(false)
const metadataDialogLoading = ref(false)

const withoutImage = computed(() => {
  return isNull(props.modelValue)
})

// const { image, modelValue } = toRefs(props)

const resolvedSrc = ref('')

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const enabledInteractionComputed = computed(() => {
  return true
})

const imageLoaded = computed(() => {
  return !isNull(resImage.value)
})

const actionEditMeta = () => {
  imageStore.setImageDetail(toRaw(resImage.value))
  metadataDialog.value = true
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const onDrop = (files: File[]) => {
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
  uploadQueueDialog.value = true
}
const onFileInput = (files: File[]) => {
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
  uploadQueueDialog.value = true
}

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetExtSystemConfig.value
)

const reload = async (newImage: ImageAware | undefined, newImageId: IntegerIdNullable, force = false) => {
  resolvedSrc.value = imagePlaceholderPath
  if ((newImage && isNull(resImage.value)) || (newImage && force)) {
    resImage.value = cloneDeep(newImage)
    if (resImage.value) {
      resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value))
    }
    return
  }
  if (newImageId) {
    try {
      resImage.value = await fetchImage(imageClient, newImageId)
    } catch (error) {
      showErrorsDefault(error)
    }
    if (!isNull(resImage.value)) {
      resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value))
    }
    return
  }
}

const reset = () => {
  resolvedSrc.value = imagePlaceholderPath
  resImage.value = null
  emit('update:modelValue', null)
}

watch(
  [() => props.image, () => props.modelValue],
  async ([newImage, newImageId]) => {
    await reload(newImage, newImageId)
  },
  { immediate: true }
)

const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  metadataDialogLoading.value = true
  imageStore.setImageDetail(null)
  metadataDialog.value = true
  let description = ''
  let source = ''
  if (data.type === 'asset') {
    if (!data.value[0] || !data.value[0].mainFile) return
    try {
      const assetRes = await fetchAsset(damClient, data.value[0].id)
      if (isString(assetRes.metadata.customData?.description)) {
        description = assetRes.metadata.customData.description.trim()
      }
      if (assetRes.authors.length > 0) {
        const authorsRes = await fetchAuthorListByIds(damClient, props.extSystem, assetRes.authors)
        source = authorsRes.map((author) => author.name).join(', ')
      }
    } catch (e) {
      showErrorsDefault(e)
    }
    const image: ImageCreateUpdateAware = {
      texts: {
        description: description,
        source: source,
      },
      dam: {
        damId: data.value[0].mainFile.id,
        regionPosition: 0,
      },
      position: 1,
    }
    if (!isNull(props.modelValue)) {
      image.id = props.modelValue
    }
    imageStore.setImageDetail(image)
    metadataDialogLoading.value = false
  }
}

const assetDetailStore = useAssetDetailStore()
const { loading: assetLoading, dialog: assetDialog } = storeToRefs(assetDetailStore)
const { damClient } = useCommonAdminCoreDamOptions()

const onEditAsset = async (assetFileId: DocId) => {
  assetLoading.value = true
  assetDialog.value = true
  try {
    const asset = await fetchAssetByFileId(damClient, assetFileId)
    assetDetailStore.setAsset(asset)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    assetLoading.value = false
  }
}

const onMetadataDialogClose = () => {
  imageStore.setImageDetail(null)
  metadataDialog.value = false
}

const onMetadataDialogConfirm = async () => {
  if (isNull(imageStore.imageDetail)) return
  metadataDialogSaving.value = true
  try {
    const res = imageStore.imageDetail.id
      ? await updateImage(imageClient, imageStore.imageDetail.id, imageStore.imageDetail)
      : await createImage(imageClient, imageStore.imageDetail)
    metadataDialog.value = false
    emit('update:modelValue', res.id)
    imageStore.setImageDetail(null)
    reload(res, res.id, true)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
  }
}

const onImageDelete = async () => {
  if (isNull(props.modelValue)) return
  if (props.callDeleteApiOnRemove) {
    try {
      await deleteImage(imageClient, props.modelValue)
      reset()
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
  reset()
}

const onAssetUploadConfirm = (items: ImageCreateUpdateAware[]) => {
  if (!items[0]) return

  if (!isNull(props.modelValue)) {
    items[0].id = props.modelValue
  }
  imageStore.setImageDetail(items[0])
  metadataDialog.value = true
}

const expandedUploadButton = ref<InstanceType<typeof AFileInput> | null>(null)

const onDropzoneClick = () => {
  if (!props.expandOptions) {
    clickMenuOpened.value = true
    return
  }
  expandedUploadButton.value?.activate()
}
</script>

<template>
  <div class="a-image-widget">
    <div class="a-image-widget__options">
      <h4
        v-if="label"
        class="font-weight-bold text-subtitle-2"
      >
        {{ label }}
      </h4>
      <div v-show="enabledInteractionComputed">
        <div
          v-if="expandOptions"
          class="d-flex flex-row"
        >
          <VBtn
            v-if="imageLoaded"
            class="mr-2 mb-2"
            @click="actionEditMeta"
          >
            {{ t('common.damImage.image.meta.edit') }}
          </VBtn>
          <VBtn
            class="mr-2 mb-2"
            @click="actionLibrary"
          >
            <span v-if="imageLoaded">{{ t('common.damImage.image.button.replaceFromDam') }}</span>
            <span v-else>{{ t('common.damImage.image.button.addFromDam') }}</span>
          </VBtn>
          <AFileInput
            ref="expandedUploadButton"
            :file-input-key="uploadQueue?.fileInputKey"
            :accept="uploadAccept"
            :max-sizes="uploadSizes"
            @files-input="onFileInput"
          >
            <template #activator="{ props: fileInputProps }">
              <VBtn v-bind="fileInputProps">
                {{ t('common.damImage.image.button.upload') }}
              </VBtn>
            </template>
          </AFileInput>
        </div>
        <VBtn
          v-else
          variant="text"
          size="x-small"
          icon
        >
          <VIcon icon="mdi-dots-horizontal" />
          <VTooltip
            activator="parent"
            location="top"
          >
            {{ t('common.damImage.image.button.options') }}
          </VTooltip>
          <VMenu
            v-model="clickMenuOpened"
            activator="parent"
            location="bottom right"
            eager
          >
            <VCard>
              <VList density="compact">
                <VListItem
                  v-if="imageLoaded"
                  @click="actionEditMeta"
                >
                  <VListItemTitle>{{ t('common.damImage.image.meta.edit') }}</VListItemTitle>
                </VListItem>
                <VListItem @click="actionLibrary">
                  <VListItemTitle>
                    <span v-if="imageLoaded">{{ t('common.damImage.image.button.replaceFromDam') }}</span>
                    <span v-else>{{ t('common.damImage.image.button.addFromDam') }}</span>
                  </VListItemTitle>
                </VListItem>
                <AFileInput
                  :file-input-key="uploadQueue?.fileInputKey"
                  :accept="uploadAccept"
                  :max-sizes="uploadSizes"
                  @files-input="onFileInput"
                >
                  <template #activator="{ props: fileInputProps }">
                    <VListItem @click.stop="fileInputProps.onClick">
                      {{ t('common.damImage.image.button.upload') }}
                    </VListItem>
                  </template>
                </AFileInput>
                <VListItem
                  v-if="imageLoaded"
                  @click="onImageDelete"
                >
                  <VListItemTitle>{{ t('common.damImage.image.button.removeImage') }}</VListItemTitle>
                </VListItem>
              </VList>
            </VCard>
          </VMenu>
        </VBtn>
      </div>
    </div>
    <div class="position-relative">
      <VImg
        :lazy-src="imagePlaceholderPath"
        :src="resolvedSrc"
        :width="width"
        cover
        max-width="100%"
        class="disable-radius"
      >
        <template #placeholder>
          <div class="d-flex align-center justify-center h-100">
            <VProgressCircular
              indeterminate
              color="grey-lighten-4"
            />
          </div>
        </template>
      </VImg>
      <AImageDropzone
        variant="fill"
        transparent
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        :hide-text="!withoutImage"
        @on-click="onDropzoneClick"
        @on-drop="onDrop"
      />
    </div>
  </div>
  <AAssetSelect
    v-model="assetSelectDialog"
    :asset-licence-id="licenceId"
    :min-count="1"
    :max-count="1"
    :asset-type="DamAssetType.Image"
    return-type="asset"
    @on-confirm="onAssetSelectConfirm"
  />
  <ImageDetailDialogMetadata
    v-model="metadataDialog"
    :saving="metadataDialogSaving"
    :loading="metadataDialogLoading"
    @edit-asset="onEditAsset"
    @on-confirm="onMetadataDialogConfirm"
    @on-close="onMetadataDialogClose"
  />
  <AssetDetailDialog :queue-key="queueKey" />
  <UploadQueueDialogSingle
    v-if="uploadQueueDialog"
    :queue-key="queueKey"
    :ext-system="extSystem"
    :file-input-key="uploadQueue?.fileInputKey ?? -1"
    :accept="uploadAccept"
    :max-sizes="uploadSizes"
    @on-apply="onAssetUploadConfirm"
  />
</template>
