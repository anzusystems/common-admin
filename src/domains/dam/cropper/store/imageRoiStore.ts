import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetFileImage } from '@/domains/dam/types/AssetFile'
import type { RegionOfInterest } from '@/domains/dam/types/Roi'
import { ref } from 'vue'

/**
 * The image and the region of interest `ADamAssetImageRoiSelect` shows: filled by the panel of regions beside it,
 * the library's in its asset detail, an admin's own in a detail of its own (exported as `useDamImageRoiStore`). One
 * store for both: admin-dam defined one of its own under the same id, and whichever was created first lacked the
 * members of the other. The two times are an admin's to read: `forceReloadRoiPreviews()` and `forceReloadCropper()`
 * only set a new one (admin-dam draws its previews of the regions anew by `timestampRoiPreviews`).
 * `ADamAssetImageRoiSelect` reads neither: it draws the cropper anew when `imageFile` changes, so after a rotation an
 * admin sets the file read anew (`setImageFile`).
 * `cropperBusy` is the cropper's own, apart from `loader`, which stays the panel's: on from the save of a region till
 * no save of it is on its way and the read of the file the DAM redraws two seconds after the latest answered one is
 * over (applied, dropped or failed), and off when the cropper goes. A panel offers no refresh of the regions while it is on: its read, sent before the redraw, would take
 * the place of the cropper's. After the cropper's read the previews of the regions are drawn anew
 * (`forceReloadRoiPreviews()`).
 */
export const useImageRoiStore = defineStore('commonAdminDamImageRoiStore', () => {
  const imageFile = ref<null | AssetFileImage>(null)
  const loader = ref(false)
  const roi = ref<null | RegionOfInterest>(null)
  const timestampCropper = ref(Date.now())
  const timestampRoiPreviews = ref(Date.now())
  const cropperBusy = ref(false)

  function setImageFile(newFile: AssetFileImage | null) {
    imageFile.value = newFile
  }

  function setRoi(newRoi: RegionOfInterest | null) {
    roi.value = newRoi
  }

  function showLoader() {
    loader.value = true
  }

  function hideLoader() {
    loader.value = false
  }

  function forceReloadRoiPreviews() {
    timestampRoiPreviews.value = Date.now()
  }

  function forceReloadCropper() {
    timestampCropper.value = Date.now()
  }

  function setCropperBusy(busy: boolean) {
    cropperBusy.value = busy
  }

  function reset() {
    imageFile.value = null
    loader.value = false
    roi.value = null
    timestampCropper.value = Date.now()
    timestampRoiPreviews.value = Date.now()
  }

  return {
    imageFile,
    loader,
    roi,
    timestampCropper,
    timestampRoiPreviews,
    cropperBusy,
    setImageFile,
    setRoi,
    showLoader,
    hideLoader,
    forceReloadRoiPreviews,
    forceReloadCropper,
    setCropperBusy,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useImageRoiStore, import.meta.hot))
}
