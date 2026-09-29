import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MediaAware } from '@/domains/dam/types/MediaAware'
import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import { cloneDeep, isNull } from '@/shared/utils/common'

export const isMediaAware = (item: MediaAware | ImageCreateUpdateAware | null): item is MediaAware => {
  if (isNull(item)) return false
  return 'damMedia' in item
}

export const isImageCreateUpdateAware = (
  item: MediaAware | ImageCreateUpdateAware | null
): item is ImageCreateUpdateAware => {
  if (isNull(item)) return false
  return !('damMedia' in item) && 'texts' in item
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
