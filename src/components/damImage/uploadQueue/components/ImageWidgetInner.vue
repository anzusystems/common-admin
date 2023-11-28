<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { ImageAware } from '@/types/ImageAware'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { computed, inject, ref, type ShallowRef, toRefs, watch } from 'vue'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useImageActions, useImageWriteActions } from '@/components/damImage/composables/imageActions'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import { DamAssetType } from '@/types/coreDam/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import AFileInput from '@/components/file/AFileInput.vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import { fetchImage } from '@/components/damImage/composables/imageApi'

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
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)
const { actionDelete } = useImageWriteActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()

const resImage = ref<null | ImageAware>(null)
const clickMenuOpened = ref(false)
const assetSelectDialog = ref(false)

const withoutImage = computed(() => {
  return isNull(props.modelValue)
})

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

const onDrop = (files: File[]) => {
  console.log('onDrop', files)
  uploadQueuesStore.addByFiles(props.queueKey, props.licenceId, files)
}
const onFileInput = (files: File[]) => {
  console.log('onFileInput', files)
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
        resImage.value = await fetchImage(imageClient, newImageId)
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
    // todo(data.value, withoutImage.value)
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
            @files-input="onFileInput"
          >
            <template #activator="{ props: fileInputProps }">
              <VBtn v-bind="fileInputProps">
                Upload
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
            Image options
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
                  <VListItemTitle>Update metadata</VListItemTitle>
                </VListItem>
                <VListItem @click.stop="actionLibrary">
                  <VListItemTitle>
                    <span v-if="imageLoaded">Replace from library</span>
                    <span v-else>Choose from library</span>
                  </VListItemTitle>
                </VListItem>
                <AFileInput
                  :file-input-key="uploadQueue?.fileInputKey"
                  :accept="uploadAccept"
                  :max-sizes="uploadSizes"
                  @files-input="onFileInput"
                >
                  <template #activator="{ props: fileInputProps }">
                    <VListItem @click.stop="fileInputProps.onClick($event)">
                      Upload
                    </VListItem>
                  </template>
                </AFileInput>
                <VListItem
                  v-if="imageLoaded"
                  @click="actionDelete(props.modelValue)"
                >
                  <VListItemTitle>Remove image</VListItemTitle>
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
        :hide-text="modelValue !== null"
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
