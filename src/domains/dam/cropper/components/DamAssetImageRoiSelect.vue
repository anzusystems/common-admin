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
import type { AssetFileImage } from '@/domains/dam/types/AssetFile'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    configName?: string
    readonly?: boolean
  }>(),
  {
    configName: undefined,
    readonly: false,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { showRecordWas, showErrorsDefault } = useAlerts()

const cropperContainerStyle = { overflow: 'hidden', maxHeight: 'calc(100vh - 160px)' }
// What overriding `.cropper-modal` used to buy: the wash over everything outside the region is the
// admin's own light grey rather than cropper.js' black. The v2 elements keep their styling inside a
// shadow root, so it is passed in as a colour instead of reached for with a selector.
const cropperShadeColor = 'rgba(241, 244, 246, 0.5)'

const imageRoiStore = useImageRoiStore()

const { damClient, endPointImage, endPointRoi } = useCommonAdminCoreDamOptions(damConfigName)
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

// Two seconds after a save the file of the region is read again, as the DAM has redrawn it. The read is for that
// file and only while the store still holds what the save left: the very object of the file (a rotation, another
// slot or another asset put another), the region saved (admin-dam's change of slot takes the region away at once,
// before the file of the new slot is read) and the cropper. Otherwise it keeps what it has, and the loader is left to
// whoever shows the other file. It read the file shown when the two seconds were up, and put its answer in the store
// whenever it came, over the file of another slot or a rotated one. Of two saves only the read after the latest is
// put in the store: the read after the first, answering last, brought the file as the DAM had drawn it before.
interface SavedRegion {
  save: number
  file: AssetFileImage
  regionId: DocId
}
let unmounted = false
let reloadTimer: ReturnType<typeof setTimeout> | undefined
let savedRegions = 0
const isStillShown = (saved: SavedRegion) =>
  !unmounted &&
  saved.save === savedRegions &&
  imageRoiStore.imageFile === saved.file &&
  imageRoiStore.roi?.id === saved.regionId

const reloadSavedFile = async (saved: SavedRegion) => {
  if (!isStillShown(saved)) return
  // Decided once the read is back, and kept: the file it puts in the store is a new object, which the check no
  // longer finds, and the loader is its to hide all the same.
  let applies = false
  try {
    const file = await fetchImageFile(damClient, endPointImage, saved.file.id)
    applies = isStillShown(saved)
    if (applies) imageRoiStore.setImageFile(file)
  } catch (error) {
    applies = isStillShown(saved)
    if (applies) showErrorsDefault(error)
  } finally {
    if (applies) imageRoiStore.hideLoader()
  }
}

const saveRoi = async (committed: CropRect) => {
  const { roi, imageFile } = imageRoiStore
  if (!roi || !imageFile || props.readonly) return

  const region = cropToRegion(committed, roi, imageFile.imageAttributes.width, imageFile.imageAttributes.height)
  try {
    imageRoiStore.showLoader()
    await updateRoi(damClient, endPointRoi, region.id, region)
    showRecordWas('updated')
    const saved: SavedRegion = { save: ++savedRegions, file: imageFile, regionId: region.id }
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => reloadSavedFile(saved), 2000)
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
  unmounted = true
  clearTimeout(reloadTimer)
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
    v-if="showCropper && configExtSystem.image && !readonly"
    :key="imageRoiStore.imageFile?.manipulatedAt || 0"
    v-model="crop"
    :aspect-ratio="configExtSystem.image.roiWidth / configExtSystem.image.roiHeight"
    :container-style="cropperContainerStyle"
    :shade-color="cropperShadeColor"
    :src="imageUrl"
    @commit="saveRoi"
  />
  <VImg
    v-else-if="showCropper"
    :src="imageUrl"
    :max-height="cropperContainerStyle.maxHeight"
    data-cy="roi-readonly-image"
  />
</template>
