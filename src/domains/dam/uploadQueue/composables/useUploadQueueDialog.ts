import { onBeforeUnmount, ref } from 'vue'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const uploadQueueDialog = ref<UploadQueueKey | null>(null)
// The queue whose dialog is saving right now. "Save and apply" ends with the queue emptied: its host takes no file
// for that queue meanwhile, through an entry of its own, as the dialog takes none through its "+" and its dropzone.
const uploadQueueDialogSaving = ref<UploadQueueKey | null>(null)
const uploadQueueSidebar = ref(false)
// The upload dialogs drawn now, by their queue: two widgets of one queue key each draw theirs.
const dialogsDrawn = new Map<UploadQueueKey, number>()

/**
 * For an upload dialog, from its setup: drawn till it is unmounted. Gone with its widget (the editor sent out of the
 * article during an upload), the last dialog of its queue forgets that dialog named: the app kept the name, and the next
 * widget of that queue opened the dialog at once. Not while another dialog of the queue is still drawn: the name closed
 * that one as well. The queue itself is left as it is.
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
   * Before files or the copy of an asset are added to the queue `queueKey` from outside its dialog. A queue no dialog
   * names holds only the rows a dialog that went away with its widget left there (the editor sent out of the article
   * during an upload), and the dialog opened for the new file showed the first of them, the old file, and its "save and
   * apply" handed the widget that one. Such a queue is stopped first: the uploads of its rows stop, and an asset an
   * upload has made stays in the DAM.
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
