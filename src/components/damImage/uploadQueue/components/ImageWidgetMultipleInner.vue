<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { computed, inject, onMounted, ref, type ShallowRef } from 'vue'
import { isUndefined } from '@/utils/common'
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
      images.value.map((image) => image.id)
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
  console.log('onFileInput', files)
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
  uploadQueueDialog.value = true
}

const onDrop = (files: File[]) => {
  console.log('onDrop', files)
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
  uploadQueueDialog.value = true
}

const onAssetSelectConfirm = (data: AssetSelectReturnData) => {
  if (data.type === 'asset') {
    console.log(data.value)
    // todo(data.value, withoutImage.value)
  }
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
  <AAssetSelect
    v-model="assetSelectDialog"
    :asset-licence-id="licenceId"
    :min-count="1"
    :max-count="1"
    :asset-type="DamAssetType.Image"
    return-type="asset"
    @on-confirm="onAssetSelectConfirm"
  />
  <div class="position-relative">
    <ImageWidgetMultipleItem
      v-for="(image, index) in images"
      :key="image.id"
      :index="index"
    />
    <AImageDropzone
      variant="fill"
      transparent
      :accept="uploadAccept"
      :max-sizes="uploadSizes"
      @on-drop="onDrop"
    />
  </div>
  <UploadQueueDialog
    :queue-key="queueKey"
    :file-input-key="uploadQueue?.fileInputKey"
    :accept="uploadAccept"
    :max-sizes="uploadSizes"
  />
</template>

<style lang="scss"></style>
