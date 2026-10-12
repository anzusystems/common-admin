import { ref } from 'vue'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'

const uploadQueueDialog = ref<UploadQueueKey | null>(null)
// The queue whose dialog is saving right now. "Save and apply" ends with the queue emptied: its host takes no file
// for that queue meanwhile, through an entry of its own, as the dialog takes none through its "+" and its dropzone.
const uploadQueueDialogSaving = ref<UploadQueueKey | null>(null)
const uploadQueueSidebar = ref(false)

export function useUploadQueueDialog() {
  const toggleUploadQueueSidebar = () => {
    uploadQueueSidebar.value = !uploadQueueSidebar.value
  }

  return {
    toggleUploadQueueSidebar,
    uploadQueueDialog,
    uploadQueueDialogSaving,
    uploadQueueSidebar,
  }
}
