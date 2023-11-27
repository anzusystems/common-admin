import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageAware } from '@/types/ImageAware'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageAware[]>([])

  function setImages (data: ImageAware[]) {
    images.value = data
  }

  function reset () {
    images.value = []
  }

  return {
    images,
    setImages,
    reset,
  }
})
