<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useImageRoiStore } from '@/domains/dam/cropper/store/imageRoiStore'
import { updateRoi } from '@/domains/dam/api/damImageRoiApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { cropToRegion, regionToCrop } from '@/domains/dam/cropper/utils/cropperJsService'
import ACropper from '@/domains/dam/cropper/components/ACropper.vue'
import type { CropRect } from '@/domains/dam/cropper/utils/cropperTypes'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'
import { fetchImageFile } from '@/domains/dam/api/damImageApi'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)

const { showRecordWas, showErrorsDefault } = useAlerts()

const cropperContainerStyle = { overflow: 'hidden', maxHeight: 'calc(100vh - 160px)' }
// What overriding `.cropper-modal` used to buy: the wash over everything outside the region is the
// admin's own light grey rather than cropper.js' black. The v2 elements keep their styling inside a
// shadow root, so it is passed in as a colour instead of reached for with a selector.
const cropperShadeColor = 'rgba(241, 244, 246, 0.5)'

const imageRoiStore = useImageRoiStore()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient, endPointImage, endPointRoi } = useCommonAdminCoreDamOptions(props.configName)
const { getDamConfigExtSystem } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)

if (isUndefined(configExtSystem)) {
  throw new Error('DamAssetImageRoiSelect: Ext system must be initialised.')
}

const imageUrl = computed(() => {
  if (imageRoiStore.imageFile && imageRoiStore.imageFile.links?.image_detail) {
    return imageRoiStore.imageFile.links.image_detail.url + '?manipulated=' + imageRoiStore.imageFile.manipulatedAt
  }
  return ''
})

/** The stored region as the cropper wants it: fractions of the picture. */
const crop = ref<CropRect | null>(null)

const readStoredRegion = () => {
  const { roi, imageFile } = imageRoiStore
  crop.value =
    roi && imageFile ? regionToCrop(roi, imageFile.imageAttributes.width, imageFile.imageAttributes.height) : null
}
readStoredRegion()
watch(() => imageRoiStore.roi, readStoredRegion)

const loadImageFile = async (id: DocId) => {
  try {
    imageRoiStore.setImageFile(await fetchImageFile(damClient, endPointImage, id))
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    imageRoiStore.hideLoader()
  }
}

const saveRoi = async (committed: CropRect) => {
  const { roi, imageFile } = imageRoiStore
  if (!roi || !imageFile) return

  const region = cropToRegion(committed, roi, imageFile.imageAttributes.width, imageFile.imageAttributes.height)
  try {
    imageRoiStore.showLoader()
    await updateRoi(damClient, endPointRoi, region.id, region)
    showRecordWas('updated')
    setTimeout(() => {
      if (imageRoiStore.imageFile) {
        loadImageFile(imageRoiStore.imageFile.id)
      }
    }, 2000)
  } catch (error) {
    imageRoiStore.hideLoader()
    showErrorsDefault(error)
  }
}

const showCropper = computed(() => {
  if (imageRoiStore.imageFile && imageUrl.value.length > 0 && !imageRoiStore.loader) {
    return true
  }
  return false
})

onUnmounted(() => {
  crop.value = null
})
</script>

<template>
  <div
    v-if="imageRoiStore.loader"
    class="d-flex w-100 align-center justify-center"
  >
    <VProgressCircular indeterminate />
  </div>
  <ACropper
    v-if="showCropper && configExtSystem.image"
    :key="imageRoiStore.imageFile?.manipulatedAt || 0"
    v-model="crop"
    :aspect-ratio="configExtSystem.image.roiWidth / configExtSystem.image.roiHeight"
    :container-style="cropperContainerStyle"
    :shade-color="cropperShadeColor"
    :src="imageUrl"
    @commit="saveRoi"
  />
</template>
