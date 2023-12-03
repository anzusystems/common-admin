<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import { computed, inject, onMounted, ref, type ShallowRef, toRaw } from 'vue'
import { isNull, isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import ImageWidgetMultipleItem from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
import { bulkUpdateImages, fetchImageListByIds } from '@/components/damImage/uploadQueue/api/imageApi'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'
import { DamAssetType } from '@/types/coreDam/Asset'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import AFileInput from '@/components/file/AFileInput.vue'
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import UploadQueueDialog from '@/components/damImage/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import { fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import { generateUUIDv1 } from '@/utils/generator'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    width?: number | undefined
  }>(),
  {
    configName: 'default',
    label: undefined,
    image: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    width: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()

const assetSelectDialog = ref(false)

const imageWidgetExtSystemConfig = inject<ShallowRef<DamExtSystemConfig> | undefined>(
  ImageWidgetExtSystemConfig,
  undefined
)

if (isUndefined(imageWidgetExtSystemConfig)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { showErrorsDefault } = useAlerts()

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetExtSystemConfig.value
)

const imagesLoading = ref(false)

const imageStore = useImageStore()
const { images, maxPosition } = storeToRefs(imageStore)

const fetchImagesOnLoad = async () => {
  try {
    imagesLoading.value = true
    const imagesRes = await fetchImageListByIds(imageClient, props.modelValue)
    imageStore.setImages(
      imagesRes.map((imageRes) => {
        imageStore.updateMaxPositionIfGreater(imageRes.position)
        return {
          key: generateUUIDv1(),
          ...imageRes,
        }
      })
    )
    emit('update:modelValue', images.value.map((image) => image.id).filter((id) => id !== undefined) as IntegerId[])
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    imagesLoading.value = false
  }
}

const uploadQueuesStore = useUploadQueuesStore()

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const { uploadQueueDialog } = useUploadQueueDialog()

const onFileInput = (files: File[]) => {
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
  uploadQueueDialog.value = true
}

const onDrop = (files: File[]) => {
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
  uploadQueueDialog.value = true
}

const onAssetSelectConfirm = (data: AssetSelectReturnData) => {
  if (data.type === 'asset') {
    if (data.value.length === 0) return
    const items = data.value
      .filter((asset) => !isNull(asset.mainFile))
      .map((assetWithMainFile) => {
        maxPosition.value++
        return {
          key: generateUUIDv1(),
          texts: {
            description: 'todo',
            source: 'todo',
          },
          dam: {
            damId: assetWithMainFile.mainFile!.id,
            regionPosition: 0,
          },
          position: maxPosition.value,
        }
      })
    imageStore.addImages(items)
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

const onAssetUploadConfirm = (items: ImageCreateUpdateAware[]) => {
  if (items.length === 0) return
  imageStore.addImages(
    items.map((item) => {
      maxPosition.value++
      return {
        key: generateUUIDv1(),
        ...item,
        position: maxPosition.value,
      }
    })
  )
  uploadQueueDialog.value = false
  uploadQueuesStore.stopUpload(props.queueKey)
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const saveImages = async () => {
  try {
    const resItems = await bulkUpdateImages(imageClient, toRaw(images.value))
    const ids: IntegerId[] = []
    const items = resItems.map((resItem) => {
      ids.push(resItem.id)
      return {
        key: generateUUIDv1(),
        ...resItem,
      }
    })
    imageStore.setImages(items)
    emit('update:modelValue', ids)
  } catch (e) {
    //
  }
}

defineExpose({
  saveImages,
})

onMounted(() => {
  fetchImagesOnLoad()
})
</script>

<template>
  <div class="pb-2">
    <AFileInput
      :file-input-key="uploadQueue?.fileInputKey"
      :accept="uploadAccept"
      :max-sizes="uploadSizes"
      @files-input="onFileInput"
    >
      <template #activator="{ props: fileInputProps }">
        <VBtn v-bind="fileInputProps">
          Upload
        </VBtn>
      </template>
    </AFileInput>
    <VBtn
      class="mr-2"
      @click="actionLibrary"
    >
      Add from library
    </VBtn>
  </div>
  <AAssetSelect
    v-model="assetSelectDialog"
    :asset-licence-id="licenceId"
    :min-count="1"
    :max-count="50"
    :asset-type="DamAssetType.Image"
    return-type="asset"
    @on-confirm="onAssetSelectConfirm"
  />
  <div
    class="position-relative w-100"
    style="min-height: 140px"
  >
    <div class="asset-list-tiles asset-list-tiles--thumbnail">
      <ImageWidgetMultipleItem
        v-for="(image, index) in images"
        :key="image.key"
        :index="index"
        @edit-asset="onEditAsset"
      />
    </div>
    <AImageDropzone
      variant="fill"
      hover-only
      :accept="uploadAccept"
      :max-sizes="uploadSizes"
      @on-drop="onDrop"
    />
  </div>
  <UploadQueueDialog
    v-if="uploadQueueDialog"
    :queue-key="queueKey"
    :file-input-key="uploadQueue?.fileInputKey ?? -1"
    :accept="uploadAccept"
    :max-sizes="uploadSizes"
    multiple
    @on-apply="onAssetUploadConfirm"
  />
  <AssetDetailDialog />
</template>

<style lang="scss"></style>
