import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetFileImage } from '@/domains/dam/types/AssetFile'
import type { RegionOfInterest } from '@/domains/dam/types/Roi'
import { ref } from 'vue'

/**
 * Image and region of interest shown by `ADamAssetImageRoiSelect`. Filled by the region panel:
 * the library's in its asset detail, or an admin's own (exported as `useDamImageRoiStore`).
 * One store for both. admin-dam had its own store under the same
 * id, and whichever was created first lacked the other's members.
 * `forceReloadRoiPreviews()` and `forceReloadCropper()` only set new timestamps for admins to read.
 * `ADamAssetImageRoiSelect` redraws on `imageFile` change, so after a rotation call `setImageFile`.
 * `cropperBusy` is separate from the panel's `loader`. It is on from a region save until
 * no save is pending and the post-save read is over, and off when the cropper goes.
 * While on, the panel offers no refresh, since its read would replace the cropper's.
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
