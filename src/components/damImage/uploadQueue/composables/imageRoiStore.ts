import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetFileImage } from '@/types/coreDam/AssetFile'
import type { RegionOfInterest } from '@/types/coreDam/Roi'

interface State {
  imageFile: null | AssetFileImage
  loader: boolean
  roi: null | RegionOfInterest
  timestampCropper: number
  timestampRoiPreviews: number
}

export const useImageRoiStore = defineStore('damImageRoiStore', {
  state: (): State => ({
    imageFile: null,
    loader: false,
    roi: null,
    timestampCropper: Date.now(),
    timestampRoiPreviews: Date.now(),
  }),
  actions: {
    setImageFile(file: AssetFileImage | null) {
      this.imageFile = file
    },
    setRoi(roi: RegionOfInterest | null) {
      this.roi = roi
    },
    showLoader() {
      this.loader = true
    },
    hideLoader() {
      this.loader = false
    },
    forceReloadRoiPreviews() {
      this.timestampRoiPreviews = Date.now()
    },
    forceReloadCropper() {
      this.timestampCropper = Date.now()
    },
    reset() {
      this.imageFile = null
      this.loader = false
      this.roi = null
      this.timestampCropper = Date.now()
      this.timestampRoiPreviews = Date.now()
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useImageRoiStore, import.meta.hot))
}
