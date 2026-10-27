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

export const useImageMediaWidgetStore = defineStore('commonAdminImageMediaWidgetStore', () => {
  const detail = ref<MediaAware | ImageCreateUpdateAware | null>(null)
  // Widgets whose dialog shows the detail: an open image dialog or the `expandMetadata` form in the page.
  const shownBy = new Set<symbol>()

  function reset() {
    detail.value = null
  }

  /**
   * Empties the detail unless a widget other than `widget` shows it, since its form would be lost.
   */
  function resetUnlessShown(widget?: symbol) {
    if ([...shownBy].some((one) => one !== widget)) return
    detail.value = null
  }

  function setShownBy(widget: symbol, shows: boolean) {
    if (shows) shownBy.add(widget)
    else shownBy.delete(widget)
  }

  function setDetail(data: ImageCreateUpdateAware | MediaAware | null) {
    if (isNull(data)) detail.value = null
    detail.value = cloneDeep(data)
  }

  return {
    setDetail,
    detail,
    reset,
    resetUnlessShown,
    setShownBy,
  }
})
