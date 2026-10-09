import { ref } from 'vue'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { DocId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

// How long an item of the queue waits before it offers refresh.
export const SHOW_REFRESH_AFTER_SECONDS = 20

// What an item no longer waits in: it failed, it is uploaded, or it was stopped.
const ENDED: UploadQueueItemStatusType[] = [
  UploadQueueItemStatus.Failed,
  UploadQueueItemStatus.Uploaded,
  UploadQueueItemStatus.Stop,
]

/**
 * The refresh of an item of the upload queue: asks what became of its file, and settles the item accordingly.
 * The store asks, with the client of its own configuration: `_configName` only keeps the callers as they are.
 */
export function useUploadQueueItemRefresh(_configName = 'default') {
  const uploadQueuesStore = useUploadQueuesStore()
  const { showWarningT } = useAlerts()
  const refreshing = ref(false)

  /**
   * `item` is the one whose refresh was pressed and `queueKey` the queue it was pressed in, where the caller has
   * them: the warning of a failure goes by them.
   */
  const refreshItem = async (assetId: DocId, item?: UploadQueueItem, queueKey?: UploadQueueKey) => {
    refreshing.value = true
    const statusBefore = item?.status
    // A removed item keeps its status unless it was still waiting or being sent: that it is gone is read from
    // its queue.
    const removed = () => !!item && !isUndefined(queueKey) && !uploadQueuesStore.getQueueItems(queueKey).includes(item)
    try {
      const outcome = await uploadQueuesStore.refreshAsset(assetId)
      if (outcome === 'pending') showWarningT('common.damImage.queueItem.stillUploadingOrProcessing')
      // The read failed, the asset was not found, or the original of a duplicate could not be read: the user is
      // to know why the item is as it was, and that pressing again may help. Not when the item ended meanwhile,
      // by this very read or by what overtook it, or was taken out of its queue: it shows that itself, or is no
      // longer there, and "try again" would be a word about a refresh it may no longer offer.
      const ended = !!item && ((item.status !== statusBefore && ENDED.includes(item.status)) || removed())
      if (outcome === 'error' && !ended) showWarningT('common.damImage.queueItem.refreshFailed')
    } finally {
      refreshing.value = false
    }
  }

  return { refreshing, refreshItem }
}
