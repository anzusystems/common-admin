import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetFileImage } from '@/types/coreDam/AssetFile'
import type { RegionOfInterest } from '@/types/coreDam/Roi'
import { ref } from 'vue'

export const useImageRoiStore = defineStore('damImageRoiStore', () => {
  const imageFile = ref<null | AssetFileImage>(null)
  const loader = ref(false)
  const roi = ref<null | RegionOfInterest>(null)

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

  function reset() {
    imageFile.value = null
    loader.value = false
    roi.value = null
  }

  return {
    imageFile,
    loader,
    roi,
    setImageFile,
    setRoi,
    showLoader,
    hideLoader,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useImageRoiStore, import.meta.hot))
}
