import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageStoreItem[]>([])
  const maxPosition = ref(0)
  // Set by the widget: a read-only one saves nothing, so the mass operations must not change what it shows.
  const readonly = ref(false)

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
    maxPosition.value = 0
    readonly.value = false
  }

  return {
    images,
    maxPosition,
    readonly,
    setImages,
    addImages,
    updateMaxPositionIfGreater,
    removeImageByIndex,
    reset,
  }
})
