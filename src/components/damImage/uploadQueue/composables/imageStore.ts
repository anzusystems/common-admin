import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import { cloneDeep, isNull } from '@/utils/common'

export const useImageStore = defineStore('commonImageStore', () => {
  const images = ref<ImageCreateUpdateAware[]>([])
  const imageDetail = ref<ImageCreateUpdateAware | null>(null)

  function setImageDetail (data: ImageCreateUpdateAware | null) {
    if (isNull(data)) imageDetail.value = null
    imageDetail.value = cloneDeep(data)
    console.log(imageDetail.value)
  }

  function setImages (data: ImageCreateUpdateAware[]) {
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
