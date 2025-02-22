import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MediaAware } from '@/types/MediaAware.ts'
import type { ImageCreateUpdateAware } from '@/types/ImageAware.ts'
import { cloneDeep, isNull } from '@/utils/common.ts'

export const isMediaAware = (item: MediaAware | ImageCreateUpdateAware | null): item is MediaAware => {
  if (isNull(item)) return false
  return 'extService' in item
}

export const isImageCreateUpdateAware = (
  item: MediaAware | ImageCreateUpdateAware | null
): item is ImageCreateUpdateAware => {
  if (isNull(item)) return false
  return !('extService' in item) && 'texts' in item
}

export const useImageMediaWidgetStore = defineStore('commonImageMediaWidgetStore', () => {
  const detail = ref<MediaAware | ImageCreateUpdateAware | null>(null)

  function reset() {
    detail.value = null
  }

  function setDetail(data: ImageCreateUpdateAware | MediaAware | null) {
    if (isNull(data)) detail.value = null
    detail.value = cloneDeep(data)
  }

  return {
    setDetail,
    detail,
    reset,
  }
})
