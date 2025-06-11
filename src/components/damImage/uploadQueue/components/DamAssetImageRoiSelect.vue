<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import { useImageRoiStore } from '@/components/damImage/uploadQueue/composables/imageRoiStore'
import { updateRoi } from '@/components/damImage/uploadQueue/api/damImageRoiApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { cropToRegion, regionToCrop } from '@/components/damImage/uploadQueue/composables/cropperJsService'
import ACropperjs from '@/components/ACropperjs.vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {}
)

const { showRecordWas, showErrorsDefault } = useAlerts()

const cropperContainerStyle = { overflow: 'hidden', maxHeight: 'calc(100vh - 160px)' }

const imageRoiStore = useImageRoiStore()

const { damClient } = useCommonAdminCoreDamOptions()
const { getDamConfigExtSystem } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)

if (isUndefined(configExtSystem)) {
  throw new Error('DamAssetImageRoiSelect: Ext system must be initialised.')
}

const cropper = ref<any>(null) // fix any

const imageUrl = computed(() => {
  if (imageRoiStore.imageFile && imageRoiStore.imageFile.links?.image_detail) {
    return imageRoiStore.imageFile.links.image_detail.url
  }
  return ''
})

const enableCropper = () => {
  if (cropper.value) {
    cropper.value.enable()
  }
}

const disableCropper = () => {
  if (cropper.value) {
    cropper.value.disable()
  }
}

const applyRegionOfInterest = () => {
  if (cropper.value && imageRoiStore.roi && imageRoiStore.imageFile) {
    enableCropper()
    const data = regionToCrop(
      cropper.value,
      imageRoiStore.roi,
      imageRoiStore.imageFile.imageAttributes.width,
      imageRoiStore.imageFile.imageAttributes.height
    )
    cropper.value.setData(data)
    disableCropper()
  }
}

const saveRoi = async () => {
  if (cropper.value && imageRoiStore.roi && imageRoiStore.imageFile) {
    const roi = cropToRegion(
      cropper.value,
      imageRoiStore.roi,
      imageRoiStore.imageFile.imageAttributes.width,
      imageRoiStore.imageFile.imageAttributes.height
    )
    try {
      imageRoiStore.showLoader()
      await updateRoi(damClient, roi.id, roi)
      showRecordWas('updated')
      setTimeout(() => {
        imageRoiStore.forceReloadRoiPreviews()
      }, 2000)
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      imageRoiStore.hideLoader()
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
  if (cropper.value) {
    cropper.value.destroy()
    cropper.value = null
  }
})
</script>

<template>
  <ACropperjs
    v-if="showCropper"
    :key="imageRoiStore.timestampCropper"
    ref="cropper"
    :aspect-ratio="16 / 9"
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
