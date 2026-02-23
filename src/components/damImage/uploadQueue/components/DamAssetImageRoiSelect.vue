<script setup lang="ts">
import { computed, onUnmounted, useTemplateRef } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import { useImageRoiStore } from '@/components/damImage/uploadQueue/composables/imageRoiStore'
import { updateRoi } from '@/components/damImage/uploadQueue/api/damImageRoiApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import {
  cropToRegion,
  regionToCrop,
  type ACropperjsExposed,
} from '@/components/damImage/uploadQueue/composables/cropperJsService'
import ACropperjs from '@/components/ACropperjs.vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { DocId, IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'
import { fetchImageFile } from '@/components/damImage/uploadQueue/api/damImageApi'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {},
)

const { showRecordWas, showErrorsDefault } = useAlerts()

const cropperContainerStyle = { overflow: 'hidden', maxHeight: 'calc(100vh - 160px)' }

const imageRoiStore = useImageRoiStore()

const { damClient, endPointImage } = useCommonAdminCoreDamOptions()
const { getDamConfigExtSystem } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)

if (isUndefined(configExtSystem)) {
  throw new Error('DamAssetImageRoiSelect: Ext system must be initialised.')
}

const cropperInstance = useTemplateRef<ACropperjsExposed>('cropperInstance')

const imageUrl = computed(() => {
  if (imageRoiStore.imageFile && imageRoiStore.imageFile.links?.image_detail) {
    return (
      imageRoiStore.imageFile.links.image_detail.url +
      '?manipulated=' +
      imageRoiStore.imageFile.manipulatedAt
    )
  }
  return ''
})

const enableCropper = () => {
  if (cropperInstance.value) {
    cropperInstance.value.enable()
  }
}

const disableCropper = () => {
  if (cropperInstance.value) {
    cropperInstance.value.disable()
  }
}

const applyRegionOfInterest = () => {
  if (cropperInstance.value && imageRoiStore.roi && imageRoiStore.imageFile) {
    enableCropper()
    const data = regionToCrop(
      cropperInstance.value,
      imageRoiStore.roi,
      imageRoiStore.imageFile.imageAttributes.width,
      imageRoiStore.imageFile.imageAttributes.height,
    )
    cropperInstance.value.setData(data)
    disableCropper()
  }
}

const loadImageFile = async (id: DocId) => {
  const res = await fetchImageFile(damClient, endPointImage, id)
  imageRoiStore.setImageFile(res)
  imageRoiStore.hideLoader()
}

const saveRoi = async () => {
  if (cropperInstance.value && imageRoiStore.roi && imageRoiStore.imageFile) {
    const roi = cropToRegion(
      cropperInstance.value,
      imageRoiStore.roi,
      imageRoiStore.imageFile.imageAttributes.width,
      imageRoiStore.imageFile.imageAttributes.height,
    )
    try {
      imageRoiStore.showLoader()
      await updateRoi(damClient, roi.id, roi)
      showRecordWas('updated')
      setTimeout(() => {
        if (imageRoiStore.imageFile) {
          loadImageFile(imageRoiStore.imageFile.id)
        }
      }, 2000)
    } catch (error) {
      showErrorsDefault(error)
    }
  }
}

const cropperReady = () => {
  applyRegionOfInterest()
  enableCropper()
}

const cropperEnd = () => {
  saveRoi()
}

const showCropper = computed(() => {
  if (imageRoiStore.imageFile && imageUrl.value.length > 0 && !imageRoiStore.loader) {
    return true
  }
  return false
})

onUnmounted(() => {
  if (cropperInstance.value) {
    cropperInstance.value.destroy()
  }
})
</script>

<template>
  <div
    v-if="imageRoiStore.loader"
    class="d-flex w-100 align-center justify-center"
  >
    <VProgressCircular indeterminate />
  </div>
  <ACropperjs
    v-if="showCropper && configExtSystem.image"
    :key="imageRoiStore.imageFile?.manipulatedAt || 0"
    ref="cropperInstance"
    :aspect-ratio="configExtSystem.image.roiWidth / configExtSystem.image.roiHeight"
    :background="false"
    :check-cross-origin="false"
    :container-style="cropperContainerStyle"
    :ready="cropperReady"
    :cropend="cropperEnd"
    :src="imageUrl"
    :view-mode="1"
    :zoom-on-wheel="false"
    responsive
  />
</template>

<style lang="scss">
.cropper-modal {
  background-color: #f1f4f6;
}
</style>
