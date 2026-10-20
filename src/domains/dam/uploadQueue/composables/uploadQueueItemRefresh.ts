import { type Ref, ref } from 'vue'
import { type UploadQueueItem, UploadQueueItemStatus, type UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { UploadQueueListBinding } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import type { UploadRefreshOutcome } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { DocId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

// How long an item of the queue waits before it offers refresh.
export const SHOW_REFRESH_AFTER_SECONDS = 20

/** The warnings of a refresh, the message keys a host's `warn` is handed. */
export const REFRESH_WARNING_KEYS = {
  pendingT: 'common.damImage.queueItem.stillUploadingOrProcessing',
  failedT: 'common.damImage.queueItem.refreshFailed',
  assetGoneT: 'common.damImage.queueItem.assetGone',
  originalUnreadT: 'common.damImage.queueItem.duplicateOriginalUnread',
} as const
export type UploadRefreshWarningKey = (typeof REFRESH_WARNING_KEYS)[keyof typeof REFRESH_WARNING_KEYS]

// Why the item is as it was: the file is not done yet, or what asking again may mend, by its cause.
const WARNING_OF: Partial<Record<UploadRefreshOutcome, UploadRefreshWarningKey>> = {
  pending: REFRESH_WARNING_KEYS.pendingT,
  error: REFRESH_WARNING_KEYS.failedT,
  missing: REFRESH_WARNING_KEYS.assetGoneT,
  originalUnread: REFRESH_WARNING_KEYS.originalUnreadT,
}

/**
 * Whether a refresh may still change the item, as the row offers it: a failed one as its host says, an uploaded
 * one while it waits for its metadata, one still on its way or processed always, a stopped one never.
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
 * One refresh, and what the user is told of it. `item` is the one whose refresh was pressed, where the caller has
 * it, `gone` whether it was taken out of its queue meanwhile, and `refreshMayHelp` whether a refresh may still
 * change it once it has failed.
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
      // Taken out of its queue meanwhile: the word would be about a row nobody sees any more.
      if (gone()) return
      // Uploaded, stopped or failed while the read was on its way, by what overtook it or by this very read: what
      // the read found is about the row as it was before, and the row shows what became of it. Only the press that
      // left it without the original of its duplicate says why, as the row keeps its refresh for that.
      const changedInto = item.status === statusBefore ? null : item.status
      if (changedInto === UploadQueueItemStatus.Uploaded || changedInto === UploadQueueItemStatus.Stop) return
      if (changedInto === UploadQueueItemStatus.Failed && key !== REFRESH_WARNING_KEYS.originalUnreadT) return
      // And only while pressing again may still help it: not a failed row with no refresh left, nor an uploaded
      // one that has its form.
      if (!refreshMayStillHelp(item, refreshMayHelp)) return
    }
    warn(key)
  } finally {
    refreshing.value = false
  }
}

/** The refresh of the rows of a list, over what its host binds: the host asks, and says what came of it. */
export function createUploadQueueItemRefresh(
  queue: Pick<UploadQueueListBinding, 'items' | 'refresh' | 'refreshMayHelp' | 'warn'>
) {
  const refreshing = ref(false)
  const gone = (item: UploadQueueItem) => !queue.items().includes(item)

  const refreshItem = async (item: UploadQueueItem) => {
    // A row that is no longer in the list is not asked about.
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
 * The refresh of an item of the upload queue: asks what became of its file, and settles the item accordingly.
 * The store asks, with the client of its own configuration: `_configName` only keeps the callers as they are.
 */
export function useUploadQueueItemRefresh(_configName = 'default') {
  const uploadQueuesStore = useUploadQueuesStore()
  const { showWarningT } = useAlerts()
  const refreshing = ref(false)

  /**
   * `item` is the one whose refresh was pressed and `queueKey` the queue it was pressed in, where the caller has
   * them: the warnings of a failure and of a file not done yet go by them.
   */
  const refreshItem = (assetId: DocId, item?: UploadQueueItem, queueKey?: UploadQueueKey) =>
    refreshAndSay(
      refreshing,
      () => uploadQueuesStore.refreshAsset(assetId),
      (key) => showWarningT(key),
      item,
      // A removed item keeps its status unless it was still waiting or being sent: that it is gone is read from
      // its queue.
      () => !!item && !isUndefined(queueKey) && !uploadQueuesStore.getQueueItems(queueKey).includes(item),
      (failed) => uploadQueuesStore.refreshMayHelp(failed)
    )

  return { refreshing, refreshItem }
}
