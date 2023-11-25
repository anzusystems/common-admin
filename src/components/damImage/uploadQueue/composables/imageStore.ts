import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageAware } from '@/types/ImageAware'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageAware[]>([])

  const imageDetail = ref<ImageAware | null>(null)

  function setImages (data: ImageAware[]) {
    images.value = data
  }

  function reset () {
    images.value = []
    imageDetail.value = null
  }

  return {
    images,
    imageDetail,
    setImages,
    reset,
  }
})
