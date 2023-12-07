import { ref } from 'vue'

const uploadQueueDialog = ref(false)
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
