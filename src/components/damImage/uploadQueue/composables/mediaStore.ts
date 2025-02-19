import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MediaAware } from '@/types/MediaAware.ts'

export const useMediaStore = defineStore('commonMediaStore', () => {
  const mediaDetail = ref<MediaAware | null>(null)

  function reset() {
    mediaDetail.value = null
  }

  return {
    mediaDetail,
    reset,
  }
})
