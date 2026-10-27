import { type Ref, ref } from 'vue'
import { type UploadQueueItem, UploadQueueItemStatus, type UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { UploadQueueListBinding } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import type { UploadRefreshOutcome } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { DocId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

export const SHOW_REFRESH_AFTER_SECONDS = 20

/**
 * Message keys passed to the host's `warn` after a refresh.
 */
export const REFRESH_WARNING_KEYS = {
  pendingT: 'common.damImage.queueItem.stillUploadingOrProcessing',
  failedT: 'common.damImage.queueItem.refreshFailed',
  assetGoneT: 'common.damImage.queueItem.assetGone',
  originalUnreadT: 'common.damImage.queueItem.duplicateOriginalUnread',
} as const
export type UploadRefreshWarningKey = (typeof REFRESH_WARNING_KEYS)[keyof typeof REFRESH_WARNING_KEYS]

// Warning per refresh outcome: the file is not done yet, or what a new refresh may fix.
const WARNING_OF: Partial<Record<UploadRefreshOutcome, UploadRefreshWarningKey>> = {
  pending: REFRESH_WARNING_KEYS.pendingT,
  error: REFRESH_WARNING_KEYS.failedT,
  missing: REFRESH_WARNING_KEYS.assetGoneT,
  originalUnread: REFRESH_WARNING_KEYS.originalUnreadT,
}

/**
 * Whether a refresh may still change the item.
 * Failed: as the host's `refreshMayHelp` says. Uploaded: only while it waits for metadata.
 * Waiting, uploading or processing: always. Stopped: never.
 */
const refreshMayStillHelp = (item: UploadQueueItem, refreshMayHelp: (item: UploadQueueItem) => boolean) => {
  switch (item.status) {
    case UploadQueueItemStatus.Failed:
      return refreshMayHelp(item)
    case UploadQueueItemStatus.Uploaded:
      return !item.canEditMetadata && !item.isDuplicate
    case UploadQueueItemStatus.Stop:
      return false
    default:
      return true
  }
}

/**
 * Runs one refresh and warns the user about the result.
 * `item` is the row whose refresh was pressed, if the caller has it. `gone` tells whether it left its queue meanwhile.
 * `refreshMayHelp` tells whether a refresh may still change a failed item.
 */
const refreshAndSay = async (
  refreshing: Ref<boolean>,
  ask: () => Promise<UploadRefreshOutcome>,
  warn: UploadQueueListBinding['warn'],
  item: UploadQueueItem | undefined,
  gone: () => boolean,
  refreshMayHelp: (item: UploadQueueItem) => boolean
) => {
  refreshing.value = true
  const statusBefore = item?.status
  try {
    const key = WARNING_OF[await ask()]
    if (!key) return
    if (item) {
      // Removed from its queue meanwhile: a warning would be about a row nobody sees.
      if (gone()) return
      // The status changed while the read was in flight, by another event or by this read.
      // The result describes the old row, and the row already shows the new state.
      // Only a failure that keeps the refresh button, such as a missing duplicate original, gets a warning.
      const changedInto = item.status === statusBefore ? null : item.status
      if (changedInto === UploadQueueItemStatus.Uploaded || changedInto === UploadQueueItemStatus.Stop) return
      if (changedInto === UploadQueueItemStatus.Failed && key !== REFRESH_WARNING_KEYS.originalUnreadT) return
      // Warn only while pressing again may still help.
      // Not for a failed row with no refresh left, nor an uploaded row that has its form.
      if (!refreshMayStillHelp(item, refreshMayHelp)) return
    }
    warn(key)
  } finally {
    refreshing.value = false
  }
}

/**
 * Refresh for the rows of a list. The host binding does the request and shows the warnings.
 */
export function createUploadQueueItemRefresh(
  queue: Pick<UploadQueueListBinding, 'items' | 'refresh' | 'refreshMayHelp' | 'warn'>
) {
  const refreshing = ref(false)
  const gone = (item: UploadQueueItem) => !queue.items().includes(item)

  const refreshItem = async (item: UploadQueueItem) => {
    if (gone(item)) return
    await refreshAndSay(
      refreshing,
      () => queue.refresh(item),
      (key) => queue.warn(key),
      item,
      () => gone(item),
      (failed) => queue.refreshMayHelp(failed)
    )
  }

  return { refreshing, refreshItem }
}

/**
 * Refresh of an upload queue item: asks the server what became of its file and updates the item.
 * Uses the client of the queue's configuration. Updates rows of queue
 * `queueKey`, or of configuration `configName` when no key is given.
 */
export function useUploadQueueItemRefresh(configName: string) {
  const uploadQueuesStore = useUploadQueuesStore()
  const { showWarningT } = useAlerts()
  const refreshing = ref(false)

  /**
   * `item` and `queueKey` are the pressed row and its queue, if the caller has them.
   * The warnings for a failure and for an unfinished file depend on them.
   */
  const refreshItem = (assetId: DocId, item?: UploadQueueItem, queueKey?: UploadQueueKey) =>
    refreshAndSay(
      refreshing,
      () => uploadQueuesStore.refreshAsset(assetId, isUndefined(queueKey) ? configName : { queueKey }),
      (key) => showWarningT(key),
      item,
      // A removed item keeps its status unless it was waiting or uploading.
      // So removal is detected by checking its queue.
      () => !!item && !isUndefined(queueKey) && !uploadQueuesStore.getQueueItems(queueKey).includes(item),
      (failed) => uploadQueuesStore.refreshMayHelp(failed)
    )

  return { refreshing, refreshItem }
}
