import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageStoreItem } from '@/types/ImageAware'
import { hasNoDamCredit } from '@/components/damImage/uploadQueue/composables/damCredit'

// A taken-over image comes back with another damId, so the saved row is paired with the sent one by position.
export const keepSentDamCredit = (saved: ImageStoreItem, sent: ImageStoreItem): ImageStoreItem => ({
  ...saved,
  damAuthors: sent.damAuthors,
  showDamAuthors: hasNoDamCredit(sent.damAuthors, sent.damSources),
  damSources: sent.damSources,
  assetId: sent.assetId,
})

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageStoreItem[]>([])
  const maxPosition = ref(0)

  function setImages(data: ImageStoreItem[]) {
    images.value = data
  }

  function addImages(data: ImageStoreItem[]) {
    images.value.push(...data)
  }

  function updateMaxPositionIfGreater(newPosition: number) {
    if (newPosition > maxPosition.value) {
      maxPosition.value = newPosition
    }
  }

  function removeImageByIndex(index: number) {
    images.value.splice(index, 1)
  }

  function reset() {
    images.value = []
  }

  return {
    images,
    maxPosition,
    setImages,
    addImages,
    updateMaxPositionIfGreater,
    removeImageByIndex,
    reset,
  }
})
