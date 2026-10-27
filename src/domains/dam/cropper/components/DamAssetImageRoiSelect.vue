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
// Shade outside the region uses the admin's light grey instead of cropper.js' black.
// The v2 elements style inside a shadow root, so the colour is passed in rather than set with a selector.
const cropperShadeColor = 'rgba(241, 244, 246, 0.5)'

const imageRoiStore = useImageRoiStore()

const { damClient, endPointImage, endPointRoi } = useCommonAdminCoreDamOptions(damConfigName)
const { getDamConfigExtSystem } = useDamConfigState(undefined, damConfigName)
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

/**
 * The stored region in the cropper's format: fractions of the picture.
 */
const crop = ref<CropRect | null>(null)

const readStoredRegion = () => {
  const { roi, imageFile } = imageRoiStore
  crop.value =
    roi && imageFile ? regionToCrop(roi, imageFile.imageAttributes.width, imageFile.imageAttributes.height) : null
}
readStoredRegion()
watch(() => imageRoiStore.roi, readStoredRegion)

// Two seconds after a save, the region file is read again because the DAM has redrawn it.
// The read result is applied only if the store still holds the same file, the saved region and the cropper. A
// rotation, another slot or another asset changes the file. admin-dam's slot change removes the region at once.
// Only the read after the latest save is applied. An older read answering last would bring back the earlier drawing.
// The save and read use the cropper's own loader, never one someone else turned on.
// `cropperBusy` tells the region panel to offer no refresh meanwhile. After the read, region
// previews are redrawn. A cropper gone before its save answered does not wait for a redraw.
interface SavedRegion {
  save: number
  file: AssetFileImage
  regionId: DocId
}
let unmounted = false
let reloadTimer: ReturnType<typeof setTimeout> | undefined
let savedRegions = 0
const saving = ref(false)
const loaderShown = computed(() => imageRoiStore.loader || saving.value)
const busy = (on: boolean) => {
  saving.value = on
  imageRoiStore.setCropperBusy(on)
}
// Pending saves and whether the read after the latest answered
// save is still due. The cropper is busy until neither is left.
// Two commits make two saves. The older one's end must not clear the busy state while the newer one waits.
// A cropper that goes away clears the busy state, as the store flag may already belong to another cropper.
let savesPending = 0
let readPending = false
const settleBusy = () => {
  if (!unmounted) busy(savesPending > 0 || readPending)
}
const isStillShown = (saved: SavedRegion) =>
  !unmounted &&
  saved.save === savedRegions &&
  imageRoiStore.imageFile === saved.file &&
  imageRoiStore.roi?.id === saved.regionId

const reloadSavedFile = async (saved: SavedRegion) => {
  try {
    if (!isStillShown(saved)) return
    try {
      const file = await fetchImageFile(damClient, endPointImage, saved.file.id)
      if (isStillShown(saved)) {
        imageRoiStore.setImageFile(file)
        imageRoiStore.forceReloadRoiPreviews()
      }
    } catch (error) {
      if (isStillShown(saved)) showErrorsDefault(error)
    }
  } finally {
    // A newer save waits for a read of its own.
    if (saved.save === savedRegions) {
      readPending = false
      settleBusy()
    }
  }
}

const saveRoi = async (committed: CropRect) => {
  const { roi, imageFile } = imageRoiStore
  if (!roi || !imageFile || props.readonly) return

  const region = cropToRegion(committed, roi, imageFile.imageAttributes.width, imageFile.imageAttributes.height)
  savesPending++
  busy(true)
  try {
    await updateRoi(damClient, endPointRoi, region.id, region)
    showRecordWas('updated')
    if (unmounted) return
    const saved: SavedRegion = { save: ++savedRegions, file: imageFile, regionId: region.id }
    readPending = true
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => reloadSavedFile(saved), 2000)
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    savesPending--
    settleBusy()
  }
}

const showCropper = computed(() => {
  if (imageRoiStore.imageFile && imageUrl.value.length > 0 && !loaderShown.value) {
    return true
  }
  return false
})

onUnmounted(() => {
  unmounted = true
  clearTimeout(reloadTimer)
  imageRoiStore.setCropperBusy(false)
  crop.value = null
})
</script>

<template>
  <div
    v-if="loaderShown"
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
