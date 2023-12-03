import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageCreateUpdateAware, ImageCreateUpdateAwareKeyed } from '@/types/ImageAware'
import { cloneDeep, isNull } from '@/utils/common'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageCreateUpdateAwareKeyed[]>([])
  const imageDetail = ref<ImageCreateUpdateAware | null>(null)
  const maxPosition = ref(0)

  function setImageDetail(data: ImageCreateUpdateAware | null) {
    if (isNull(data)) imageDetail.value = null
    imageDetail.value = cloneDeep(data)
  }

  function setImages(data: ImageCreateUpdateAwareKeyed[]) {
    images.value = data
  }

  function addImages(data: ImageCreateUpdateAwareKeyed[]) {
    images.value.push(...data)
  }

  function updateMaxPositionIfGreater(newPosition: number) {
    if (newPosition > maxPosition.value) {
      maxPosition.value = newPosition
    }
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
    reset,
  }
})
