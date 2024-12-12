import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageCreateUpdateAware, ImageStoreItem } from '@/types/ImageAware'
import { cloneDeep, isNull } from '@/utils/common'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageStoreItem[]>([])
  const imageDetail = ref<ImageCreateUpdateAware | null>(null)
  const maxPosition = ref(0)

  function setImageDetail(data: ImageCreateUpdateAware | null) {
    if (isNull(data)) imageDetail.value = null
    imageDetail.value = cloneDeep(data)
  }

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
    imageDetail.value = null
  }

  return {
    images,
    imageDetail,
    maxPosition,
    setImages,
    addImages,
    setImageDetail,
    updateMaxPositionIfGreater,
    removeImageByIndex,
    reset,
  }
})
