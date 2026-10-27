import axios from 'axios'
import { getCurrentScope, onScopeDispose, reactive, toRaw } from 'vue'
import { apiErrorStatus } from '@/domains/api/utils/apiErrors'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { createUploadSettlement } from '@/domains/dam/uploadQueue/settlement/uploadSettlement'
import type { UploadRun, UploadSide } from '@/domains/dam/uploadQueue/presets/uploadPresets'
import {
  type UploadQueueCore,
  type UploadQueuePreset,
  uploadQueuePresetMembers,
} from '@/domains/dam/uploadQueue/core/uploadQueueCoreTypes'
import { isUndefined } from '@/shared/utils/common'

const QUEUE_MAX_PARALLEL_UPLOADS = 2

export const UPLOAD_QUEUE_ITEM_CHUNK_SIZE = 10485760

// File names and added assets are not unique. Rows sharing a `:key` make Vue patch the wrong row.
// One counter for all cores on the page.
let queueItemSequence = 0

// A 4xx server refusal. Upload requests reject with the raw axios error.
const isRefusal = (error: unknown) => {
  const status = axios.isAxiosError(error) ? error.response?.status : apiErrorStatus(error)

  return !isUndefined(status) && status >= 400 && status < 500
}

const isUnderWay = (status: UploadQueueItemStatusType) =>
  status === UploadQueueItemStatus.Waiting ||
  status === UploadQueueItemStatus.Uploading ||
  status === UploadQueueItemStatus.Processing

/**
 * Upload queue of a store: its queues, two uploads at a time per queue,
 * each row's run, row removal, and settlement of rows the server processes.
 * Created in the store setup.
 */
export function createUploadQueueCore<S extends UploadSide>(preset: UploadQueuePreset<S>): UploadQueueCore {
  const {
    queues,
    settlement: profile,
    runnerFor,
    onClientFailure,
    rowTracked,
    rowRemoved,
    refreshable,
  } = preset[uploadQueuePresetMembers]

  // Active runs by row, so a stop also reaches a run between chunks.
  const stopHandles = new WeakMap<UploadQueueItem, () => void>()
  // Failed rows a refresh may still change, as reported by the settlement. Reactive so rows can show it.
  const refreshableRows = reactive(new WeakSet<UploadQueueItem>())

  const { hooks, ...settlementProfile } = profile
  const settlement = createUploadSettlement({
    ...settlementProfile,
    queues: () => queues.entries(),
    hooks: {
      ...hooks,
      onRowFinal: (queueKey, row) => {
        // Z26: the server discards a failed file, so its remaining chunks are not sent.
        // Stopping the run frees its slot, so no third upload runs beside two.
        if (row.status === UploadQueueItemStatus.Failed && stopHandles.has(row)) stopRun(row)
        hooks?.onRowFinal?.(queueKey, row)
        recalculateQueueCounts(queueKey)
        processUpload(queueKey)
      },
      ...(refreshable && {
        onRefreshMayHelp: (queueKey: UploadQueueKey, row: UploadQueueItem, mayHelp: boolean) => {
          if (mayHelp) refreshableRows.add(toRaw(row))
          else refreshableRows.delete(toRaw(row))
          hooks?.onRefreshMayHelp?.(queueKey, row, mayHelp)
        },
      }),
    },
  })

  // A disposed store leaves no poll timer and no tab or socket listener.
  if (getCurrentScope()) onScopeDispose(() => settlement.dispose())

  function getQueue(queueKey: UploadQueueKey) {
    return queues.get(queueKey) ?? null
  }

  function getQueueItems(queueKey: UploadQueueKey) {
    return queues.get(queueKey)?.items ?? []
  }

  function getQueueItemsByStatus(queueKey: UploadQueueKey, status: UploadQueueItemStatusType) {
    return getQueueItems(queueKey).filter((item) => item.status === status)
  }

  function getQueueTotalCount(queueKey: UploadQueueKey) {
    return queues.get(queueKey)?.totalCount ?? 0
  }

  function getQueueProcessedCount(queueKey: UploadQueueKey) {
    return queues.get(queueKey)?.processedCount ?? 0
  }

  function getQueueFileInputKey(queueKey: UploadQueueKey) {
    return queues.get(queueKey)?.fileInputKey ?? -1
  }

  function getQueueItemsTypes(queueKey: UploadQueueKey) {
    const types: Array<DamAssetTypeType> = []
    for (const item of getQueueItems(queueKey)) {
      if (!types.includes(item.assetType)) types.push(item.assetType)
    }
    return types
  }

  function uniqueKey(prefix: string) {
    return `${prefix}_${++queueItemSequence}`
  }

  function emptyQueue(fileInputKey: number): UploadQueue {
    return {
      items: [],
      totalCount: 0,
      processedCount: 0,
      fileInputKey,
      suggestions: { newKeywordNames: new Set<string>(), newAuthorNames: new Set<string>() },
    }
  }

  function createQueue(queueKey: UploadQueueKey) {
    if (!queues.get(queueKey)) queues.set(queueKey, emptyQueue(0))
  }

  // Adding to a missing queue does nothing, as for the counts below.
  function addQueueItem(queueKey: UploadQueueKey, item: UploadQueueItem) {
    queues.get(queueKey)?.items.push(item)
  }

  function addRow(queueKey: UploadQueueKey, item: UploadQueueItem) {
    createQueue(queueKey)
    addQueueItem(queueKey, item)
    recalculateQueueCounts(queueKey)
    processUpload(queueKey)
  }

  function recalculateQueueCounts(queueKey: UploadQueueKey) {
    const queue = queues.get(queueKey)
    if (!queue) return
    queue.totalCount = queue.items.length
    queue.processedCount =
      getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Uploaded).length +
      getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Failed).length
  }

  function setUploadSpeed(item: UploadQueueItem, progress: number, speed: number, estimate: number) {
    item.progress.progressPercent = progress
    item.progress.remainingTime = estimate
    item.progress.speed = speed
  }

  function forceReloadFileInput(queueKey: UploadQueueKey) {
    createQueue(queueKey)
    const queue = queues.get(queueKey)
    if (!queue) return
    queue.fileInputKey++
  }

  function processUpload(queueKey: UploadQueueKey) {
    const waitingItems = getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Waiting)
    if (waitingItems.length === 0) return
    const freeSlots =
      QUEUE_MAX_PARALLEL_UPLOADS - getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Uploading).length
    waitingItems.slice(0, Math.max(freeSlots, 0)).forEach((item) => queueItemUploadStart(item, queueKey))
  }

  function track(queueKey: UploadQueueKey, item: UploadQueueItem, options?: { clientFailed?: boolean }) {
    rowTracked?.(queueKey, item)
    settlement.track(queueKey, item, options)
  }

  async function queueItemUploadStart(item: UploadQueueItem, queueKey: UploadQueueKey) {
    // Run already started. A row that cannot be sent stays waiting while
    // its hash loads, and the queue rechecks after each added file.
    if (stopHandles.has(item)) return
    let run: UploadRun<S> | undefined
    try {
      // Created inside the try so a preset that cannot create the run fails the row like a failed upload.
      // Otherwise the row stayed waiting and threw again on every start, with every row after it.
      run = runnerFor(item, queueKey)(item, (progress, speed, estimate) => {
        setUploadSpeed(item, progress, speed, estimate)
      })
      stopHandles.set(item, run.stop)
      await run.uploadInit()
      await run.upload()
      stopHandles.delete(item)
      // Skip a row its notification has settled meanwhile, and a stopped row.
      if (item.status === UploadQueueItemStatus.Processing) track(queueKey, item)
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    } catch (error) {
      stopHandles.delete(item)
      // Stopped: it left the queue or the queue is going, and whatever stopped it started the next row.
      // Uploaded: the processed notification arrived before the finish response, and its settlement counted the queue.
      if (item.status === UploadQueueItemStatus.Stop || item.status === UploadQueueItemStatus.Uploaded) return
      // Already failed by the settlement, which stopped the run and counted the queue.
      // The row keeps the server's reason. Nothing is overwritten or alerted (Z26).
      if (item.status === UploadQueueItemStatus.Failed) return
      // Call before writing to the row: whether the reason was already reported is read from the failed rows.
      const failure = onClientFailure?.(queueKey, item, error)
      item.error.hasError = true
      if (failure) item.error.message = failure.message
      item.status = UploadQueueItemStatus.Failed
      // Its metadata event arrives while the file is still uploading and had enabled the form.
      item.canEditMetadata = false
      failure?.alert()
      // The finish request was sent, so the server may still complete
      // the file. Keep tracking the row while it stays in the queue.
      // Not after a refusal: finish is sent once, and the server will not finish a file it refused.
      if (run?.finishAttempted() && !isRefusal(error)) {
        track(queueKey, item, { clientFailed: true })
      }
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    }
  }

  // Stops a row that is under way, or whose run continues after the server
  // settled it. Stops the run, also between chunks, and the chunk in flight.
  // A settled row without a run is left as is.
  function stopRow(item: UploadQueueItem) {
    if (!isUnderWay(item.status) && !stopHandles.has(item)) return
    item.status = UploadQueueItemStatus.Stop
    stopRun(item)
  }

  function stopRun(item: UploadQueueItem) {
    stopHandles.get(item)?.()
    stopHandles.delete(item)
    item.latestChunkAbortController?.abort()
  }

  function removeByIndex(queueKey: UploadQueueKey, index: number) {
    const queue = queues.get(queueKey)
    const item = queue?.items[index]
    if (!queue || !item) return
    stopRow(item)
    // Neither the queue poll nor a read requested by a notification asks about it any more.
    settlement.untrack(item)
    rowRemoved?.(queueKey, item)
    queue.items.splice(index, 1)
    recalculateQueueCounts(queueKey)
    // Its run, if any, ends without starting the next row, so start it here.
    processUpload(queueKey)
  }

  function stopItemUpload(queueKey: UploadQueueKey, item: UploadQueueItem) {
    const queue = queues.get(queueKey)
    if (!queue || queue.items.length === 0) return
    item.status = UploadQueueItemStatus.Stop
    settlement.untrack(item)
    stopRun(item)
    // By identity: the index the caller saw may belong to another row once the list changed.
    const currentIndex = queue.items.indexOf(item)
    if (currentIndex > -1) removeByIndex(queueKey, currentIndex)
    processUpload(queueKey)
  }

  function stopUpload(queueKey: UploadQueueKey) {
    const queue = queues.get(queueKey)
    if (!queue) return
    if (queue.items.length === 0) {
      // A queue emptied row by row still has its idle poll. Drop it with the queue.
      settlement.dropQueue(queueKey)
      return
    }
    const uploading = getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Uploading)
    queue.items.forEach((item) => {
      item.status = UploadQueueItemStatus.Stop
      stopHandles.get(item)?.()
      stopHandles.delete(item)
    })
    uploading.forEach((item) => item.latestChunkAbortController?.abort())
    clearQueue(queueKey)
    forceReloadFileInput(queueKey)
  }

  // A missing queue is created empty.
  function clearQueue(queueKey: UploadQueueKey) {
    queues.get(queueKey)?.items.forEach((item) => {
      rowRemoved?.(queueKey, item)
      stopRow(item)
    })
    // Before replacing the queue, so its rows are no longer polled.
    settlement.dropQueue(queueKey)
    queues.set(queueKey, emptyQueue(getQueueFileInputKey(queueKey) + 1))
  }

  function refreshMayHelp(item: UploadQueueItem) {
    return item.status === UploadQueueItemStatus.Failed && refreshableRows.has(toRaw(item))
  }

  return {
    settlement,
    roleOf: (item) => profile.roleOf(item),
    getQueue,
    getQueueItems,
    getQueueItemsByStatus,
    getQueueTotalCount,
    getQueueProcessedCount,
    getQueueFileInputKey,
    getQueueItemsTypes,
    uniqueKey,
    createQueue,
    addQueueItem,
    addRow,
    recalculateQueueCounts,
    setUploadSpeed,
    forceReloadFileInput,
    processUpload,
    queueItemUploadStart,
    track,
    removeByIndex,
    stopItemUpload,
    stopUpload,
    clearQueue,
    refreshMayHelp,
  }
}
