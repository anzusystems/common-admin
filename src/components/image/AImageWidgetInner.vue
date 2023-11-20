<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { computed, inject, ref, type ShallowRef, toRefs, watch } from 'vue'
import { useImageOptions } from '@/components/image/composables/imageOptions'
import { useImageActions } from '@/components/image/composables/imageActions'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import { DamAssetType } from '@/types/coreDam/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/components/dam/uploadQueue/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/dam/uploadQueue/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import AFileInput from '@/components/file/AFileInput.vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import { ImageWidgetExtSystemConfig } from '@/components/image/composables/imageWidgetInkectionKeys'
import { DamExtSystemConfig } from '@/types/coreDam/DamConfig'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
    image?: ImageWidgetImage | undefined // optional, if available, no need to fetch image data
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    disableOnClickMenu?: boolean
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
    expandOptions: false,
    disableOnClickMenu: false,
    width: undefined,
  }
)

const imageWidgetExtSystemConfig = inject<ShallowRef<DamExtSystemConfig> | undefined>(
  ImageWidgetExtSystemConfig,
  undefined
)

if (isUndefined(imageWidgetExtSystemConfig)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

const { showErrorsDefault } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useImageOptions(props.configName)
const { fetchImageWidgetData } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)
// dam config is loaded
// const { damConfigExtSystem } = useDamConfigState()
const uploadQueuesStore = useUploadQueuesStore()

const resImage = ref<null | ImageWidgetImage>(null)
const clickMenuOpened = ref(false)
const assetSelectDialog = ref(false)

const { image, modelValue } = toRefs(props)

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

const actionEditMeta = () => {}
const actionLibrary = () => {
  assetSelectDialog.value = true
}
const actionDelete = () => {}

const onDrop = (files: File[]) => {
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
}

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetExtSystemConfig.value
)

watch(
  [image, modelValue],
  async ([newImage, newImageId]) => {
    resImage.value = null
    resolvedSrc.value = imagePlaceholderPath
    if (newImage) {
      resImage.value = cloneDeep(newImage)
      if (resImage.value) {
        resolvedSrc.value = widgetImageToDamImageUrl(resImage.value)
      }
      return
    }
    if (newImageId) {
      try {
        resImage.value = await fetchImageWidgetData(newImageId)
      } catch (error) {
        showErrorsDefault(error)
      }
      if (resImage.value) {
        resolvedSrc.value = widgetImageToDamImageUrl(resImage.value)
      }
      return
    }
    return
  },
  { immediate: true }
)

const onAssetSelectConfirm = (data: AssetSelectReturnData) => {
  if (data.type === 'asset') {
    console.log(data.value)
  }
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
        {{ uploadQueue }}
        <div
          v-if="expandOptions"
          class="d-flex flex-row"
        >
          <VBtn
            v-if="imageLoaded"
            class="mr-2 mb-2"
            @click="actionEditMeta"
          >
            Edit metadata
          </VBtn>
          <VBtn
            class="mr-2 mb-2"
            @click="actionLibrary"
          >
            <span v-if="imageLoaded">Replace from library</span>
            <span v-else>Choose from library</span>
          </VBtn>
          <AFileInput
            :file-input-key="uploadQueue?.fileInputKey"
            :accept="uploadAccept"
            :max-sizes="uploadSizes"
            @files-input="onDrop"
          />
        </div>
        <VBtn
          variant="text"
          size="x-small"
          icon
        >
          <VIcon icon="mdi-dots-horizontal" />
          <VTooltip
            activator="parent"
            location="top"
          >
            Image options
          </VTooltip>
          <VMenu
            v-model="clickMenuOpened"
            activator="parent"
            location="bottom right"
          >
            <VCard>
              <VList density="compact">
                <VListItem
                  v-if="imageLoaded"
                  @click="actionEditMeta"
                >
                  <VListItem-title>Update metadata</VListItem-title>
                </VListItem>
                <VListItem @click="actionLibrary">
                  <VListItem-title>
                    <span v-if="imageLoaded">Replace from library</span>
                    <span v-else>Choose from library</span>
                  </VListItem-title>
                </VListItem>
                <AFileInput
                  :file-input-key="uploadQueue?.fileInputKey"
                  :accept="uploadAccept"
                  :max-sizes="uploadSizes"
                  @files-input="onDrop"
                >
                  <template #activator="{ props: fileInputProps }">
                    <VListItem v-bind="fileInputProps">
                      Upload
                    </VListItem>
                  </template>
                </AFileInput>
                <VListItem
                  v-if="imageLoaded"
                  @click="actionDelete"
                >
                  <VListItem-title>Remove image</VListItem-title>
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
        @on-click="clickMenuOpened = true"
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
</template>

<style lang="scss">
$class-name-root: 'a-image-widget';

.#{$class-name-root} {
  &__options {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
