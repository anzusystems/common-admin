import { onBeforeUnmount, ref } from 'vue'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const uploadQueueDialog = ref<UploadQueueKey | null>(null)
// Queue whose dialog is saving now. "Save and apply" ends with the queue emptied.
// Meanwhile the host accepts no file for that queue, as the dialog accepts none through "+" and its dropzone.
const uploadQueueDialogSaving = ref<UploadQueueKey | null>(null)
const uploadQueueSidebar = ref(false)
// Count of upload dialogs drawn per queue. Two widgets with one queue key each draw their own.
const dialogsDrawn = new Map<UploadQueueKey, number>()

/**
 * Call from an upload dialog's setup. It counts as drawn until unmounted.
 * When the last dialog of a queue unmounts with its widget (e.g. the editor leaves the article during an
 * upload), the open-dialog name is cleared. Otherwise the next widget of that queue opened the dialog at once.
 * Not while another dialog of the queue is drawn, because clearing
 * the name would close it too. The queue itself is not changed.
 */
export function useUploadQueueDialogDrawn(queueKey: UploadQueueKey) {
  dialogsDrawn.set(queueKey, (dialogsDrawn.get(queueKey) ?? 0) + 1)
  onBeforeUnmount(() => {
    const left = (dialogsDrawn.get(queueKey) ?? 1) - 1
    if (left > 0) return void dialogsDrawn.set(queueKey, left)
    dialogsDrawn.delete(queueKey)
    if (uploadQueueDialog.value === queueKey) uploadQueueDialog.value = null
  })
}

export function useUploadQueueDialog() {
  const toggleUploadQueueSidebar = () => {
    uploadQueueSidebar.value = !uploadQueueSidebar.value
  }

  /**
   * Call before adding files or an asset copy to queue `queueKey` from outside its dialog.
   * A queue no dialog names holds only rows left by a dialog that unmounted with its widget.
   * The new dialog then showed the old file and "save and apply" handed it to the widget.
   * So such a queue is stopped first. Its uploads stop, and assets already created stay in the DAM.
   */
  const stopQueueLeftBehind = (queueKey: UploadQueueKey) => {
    if (uploadQueueDialog.value !== queueKey) useUploadQueuesStore().stopUpload(queueKey)
  }

  return {
    toggleUploadQueueSidebar,
    stopQueueLeftBehind,
    uploadQueueDialog,
    uploadQueueDialogSaving,
    uploadQueueSidebar,
  }
}
