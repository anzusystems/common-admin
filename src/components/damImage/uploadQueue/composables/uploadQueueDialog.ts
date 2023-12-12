import { ref } from 'vue'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'

const uploadQueueDialog = ref<UploadQueueKey | null>(null)
const uploadQueueSidebar = ref(false)

export function useUploadQueueDialog () {
  const toggleUploadQueueSidebar = () => {
    uploadQueueSidebar.value = !uploadQueueSidebar.value
  }

  return {
    toggleUploadQueueSidebar,
    uploadQueueDialog,
    uploadQueueSidebar,
  }
}
