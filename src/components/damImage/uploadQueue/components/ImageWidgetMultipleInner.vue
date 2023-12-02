<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import { computed, inject, onMounted, ref, type ShallowRef } from 'vue'
import { isNull, isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import ImageWidgetMultipleItem from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
import { fetchImageListByIds } from '@/components/damImage/composables/imageApi'
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
const { images } = storeToRefs(imageStore)

const fetchImagesOnLoad = async () => {
  try {
    imagesLoading.value = true
    imageStore.setImages(await fetchImageListByIds(imageClient, props.modelValue))
    emit(
      'update:modelValue',
      images.value.map((image) => image.id).filter((id) => id !== undefined) as IntegerId[]
    )
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

const { uploadQueueDialog  } = useUploadQueueDialog()

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
    const images = data.value.filter((asset) => !isNull(asset.mainFile)).map((assetWithMainFile) => {
      return {
        texts: {
          description: 'todo',
          source: 'todo',
        },
        dam: {
          damId: assetWithMainFile.mainFile!.id,
          regionPosition: 0,
        },
        position: 1,
      }
    })
    imageStore.addImages(images)
  }
}

const assetDetailStore = useAssetDetailStore()
const { loading: assetLoading, dialog: assetDialog } = storeToRefs(assetDetailStore)
const { damClient } = useCommonAdminCoreDamOptions()

const onEditAsset = async (assetFileId: DocId) =>  {
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

const afterUploadApply = (items: ImageCreateUpdateAware[]) => {

}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

onMounted(() => {
  fetchImagesOnLoad()
})
</script>

<template>
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
  <AAssetSelect
    v-model="assetSelectDialog"
    :asset-licence-id="licenceId"
    :min-count="1"
    :max-count="50"
    :asset-type="DamAssetType.Image"
    return-type="asset"
    @on-confirm="onAssetSelectConfirm"
  />
  <div class="position-relative w-100">
    <ImageWidgetMultipleItem
      v-for="(image, index) in images"
      :key="image.id"
      :index="index"
      @edit-asset="onEditAsset"
    />
    <AImageDropzone
      variant="fill"
      transparent
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
    @on-apply="afterUploadApply"
  />
  <AssetDetailDialog />
</template>

<style lang="scss"></style>
