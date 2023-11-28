import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageAware } from '@/types/ImageAware'
import { cloneDeep, isNull } from '@/utils/common'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageAware[]>([])
  const imageDetail = ref<ImageAware | null>(null)

  function setImageDetail (data: ImageAware | null) {
    if (isNull(data)) imageDetail.value = null
    imageDetail.value = cloneDeep(data)
    console.log(imageDetail.value)
  }

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
    setImageDetail,
    reset,
  }
})
