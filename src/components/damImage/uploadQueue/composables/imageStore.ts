import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageStoreItem } from '@/types/ImageAware'

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
