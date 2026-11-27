<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
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
import type { RegionOfInterest } from '@/domains/dam/types/Roi'
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

// The file whose picture the cropper shows. A region does not change the picture: the detail rendition has no height,
// and the DAM crops only a rendition with both. The read after a region save brings the same file with a new
// `manipulatedAt`, and the cropper keeps the picture it has instead of hiding and loading the 1920 px picture again.
// Any other file put into the store (a rotation, another slot or asset, the panel's refresh) is shown anew.
const shownFile = shallowRef(imageRoiStore.imageFile)
let applyingReadAfterSave = false
watch(
  () => imageRoiStore.imageFile,
  (file) => {
    if (!applyingReadAfterSave) shownFile.value = file
  },
  // Sync, so a read answering right after another file was put in already sees that file.
  { flush: 'sync' }
)

const imageUrl = computed(() => {
  const file = shownFile.value
  if (file && file.links?.image_detail) {
    return file.links.image_detail.url + '?manipulated=' + file.manipulatedAt
  }
  return ''
})

/** The stored region in the cropper's format: fractions of the picture. */
const crop = ref<CropRect | null>(null)

const readStoredRegion = () => {
  const { roi, imageFile } = imageRoiStore
  crop.value =
    roi && imageFile ? regionToCrop(roi, imageFile.imageAttributes.width, imageFile.imageAttributes.height) : null
}
readStoredRegion()
watch(() => imageRoiStore.roi, readStoredRegion)

// The cropper stays shown and usable while a region is saved. Saves go one at a time, in the order of the commits:
// a crop committed while a save is on its way waits for it, and only the latest one waits.
// Two seconds after a save, the region file is read again because the DAM has redrawn it.
// The read result is applied only if the cropper still shows the same file and the saved region. A
// rotation, another slot or another asset changes the file. admin-dam's slot change removes the region at once.
// Only the read after the latest save is applied. An older read answering last would bring back the earlier drawing.
// `cropperBusy` tells the region panel to offer no refresh meanwhile. After the read, region
// previews are redrawn. A cropper gone before its save answered does not wait for a redraw.
interface CommittedRegion {
  crop: CropRect
  roi: RegionOfInterest
  file: AssetFileImage
  shown: AssetFileImage
}
interface SavedRegion {
  save: number
  shown: AssetFileImage
  regionId: DocId
}
let unmounted = false
let reloadTimer: ReturnType<typeof setTimeout> | undefined
let savedRegions = 0
let waiting: CommittedRegion | null = null
let sending = false
// Whether the read after the latest answered save is still due. The cropper is busy until it is over and nothing is
// sent or waits. A cropper that goes away clears the busy state, as the store flag may already belong to another one.
let readPending = false
const settleBusy = () => {
  if (!unmounted) imageRoiStore.setCropperBusy(sending || readPending)
}
const isStillShown = (saved: SavedRegion) =>
  !unmounted &&
  saved.save === savedRegions &&
  shownFile.value === saved.shown &&
  imageRoiStore.roi?.id === saved.regionId

const reloadSavedFile = async (saved: SavedRegion) => {
  try {
    if (!isStillShown(saved)) return
    try {
      const file = await fetchImageFile(damClient, endPointImage, saved.shown.id)
      if (isStillShown(saved)) {
        applyingReadAfterSave = true
        imageRoiStore.setImageFile(file)
        applyingReadAfterSave = false
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

const send = async ({ crop: committed, roi, file, shown }: CommittedRegion) => {
  const region = cropToRegion(committed, roi, file.imageAttributes.width, file.imageAttributes.height)
  try {
    await updateRoi(damClient, endPointRoi, region.id, region)
    showRecordWas('updated')
    if (unmounted) return
    const saved: SavedRegion = { save: ++savedRegions, shown, regionId: region.id }
    readPending = true
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => reloadSavedFile(saved), 2000)
  } catch (error) {
    showErrorsDefault(error)
  }
}

const sendInTurn = async () => {
  sending = true
  settleBusy()
  while (waiting) {
    const next = waiting
    waiting = null
    // A crop drawn on a picture no longer shown (a rotation turned it, another slot came) is not sent.
    if (shownFile.value === next.shown && imageRoiStore.roi?.id === next.roi.id) await send(next)
  }
  sending = false
  settleBusy()
}

const saveRoi = (committed: CropRect) => {
  const { roi, imageFile } = imageRoiStore
  if (!roi || !imageFile || !shownFile.value || props.readonly) return
  waiting = { crop: committed, roi, file: imageFile, shown: shownFile.value }
  if (!sending) void sendInTurn()
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
  imageRoiStore.setCropperBusy(false)
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
    :key="shownFile?.manipulatedAt || 0"
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
