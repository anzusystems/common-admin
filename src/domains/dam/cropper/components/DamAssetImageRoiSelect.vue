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
// before the file of the new slot is read) and the cropper. Otherwise it keeps what it has. It read the file shown when
// the two seconds were up, and put its answer in the store whenever it came, over the file of another slot or a
// rotated one. Of two saves only the read after the latest is put in the store: the read after the first, answering
// last, brought the file as the DAM had drawn it before.
// The save and the read after it show a loader of the cropper's own, with the store's: off whatever the read ends
// with, and never one somebody else turned on in the store. The save turned on the store's, which stayed on over a
// file shown by a way that does not hide it, and in the store when the cropper went before the read. Beside it the
// cropper is busy in the store (`cropperBusy`), for the panel of the regions: it offers no refresh meanwhile. After the
// read the previews of the regions are drawn anew. Gone before its save answered, the cropper waits for no redraw.
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
// Saves on their way, and whether the read after the latest answered save is still to come: the cropper is busy
// till neither is left. Two commits before the cropper is hidden make two saves, and the end of the older one, its
// failure or its read, turned the busy state off while the newer one still waited. A cropper that went cleared it
// as it went: the store's flag may be another cropper's by now.
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
