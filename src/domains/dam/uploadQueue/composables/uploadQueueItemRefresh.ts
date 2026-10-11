import { type Ref, ref } from 'vue'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
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
} as const
export type UploadRefreshWarningKey = (typeof REFRESH_WARNING_KEYS)[keyof typeof REFRESH_WARNING_KEYS]

// What an item no longer waits in: it failed, it is uploaded, or it was stopped.
const ENDED: UploadQueueItemStatusType[] = [
  UploadQueueItemStatus.Failed,
  UploadQueueItemStatus.Uploaded,
  UploadQueueItemStatus.Stop,
]

/**
 * One refresh, and what the user is told of it. `item` is the one whose refresh was pressed, where the caller has
 * it, and `gone` whether it was taken out of its queue meanwhile.
 */
const refreshAndSay = async (
  refreshing: Ref<boolean>,
  ask: () => Promise<UploadRefreshOutcome>,
  warn: UploadQueueListBinding['warn'],
  item: UploadQueueItem | undefined,
  gone: () => boolean
) => {
  refreshing.value = true
  const statusBefore = item?.status
  try {
    const outcome = await ask()
    // The read failed, the asset was not found, or the original of a duplicate could not be read: the user is
    // to know why the item is as it was, and that pressing again may help. Not when the item ended meanwhile,
    // by this very read or by what overtook it, or was taken out of its queue: it shows that itself, or is no
    // longer there, and "try again" would be a word about a refresh it may no longer offer. "Still uploading or
    // processing" is not said then either: the read found the file as it was before what overtook it.
    const ended = !!item && ((item.status !== statusBefore && ENDED.includes(item.status)) || gone())
    if (outcome === 'pending' && !ended) warn(REFRESH_WARNING_KEYS.pendingT)
    if (outcome === 'error' && !ended) warn(REFRESH_WARNING_KEYS.failedT)
  } finally {
    refreshing.value = false
  }
}

/** The refresh of the rows of a list, over what its host binds: the host asks, and says what came of it. */
export function createUploadQueueItemRefresh(queue: Pick<UploadQueueListBinding, 'items' | 'refresh' | 'warn'>) {
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
      () => gone(item)
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
      () => !!item && !isUndefined(queueKey) && !uploadQueuesStore.getQueueItems(queueKey).includes(item)
    )

  return { refreshing, refreshItem }
}
