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

// A file name is not unique, nor is an asset added twice: rows that share a `:key` have Vue patch the wrong one.
// One count for every core of the page.
let queueItemSequence = 0

// An answer of the server that says no (4xx). The requests of an upload reject with the error of axios as it is.
const isRefusal = (error: unknown) => {
  const status = axios.isAxiosError(error) ? error.response?.status : apiErrorStatus(error)

  return !isUndefined(status) && status >= 400 && status < 500
}

// Waiting for its turn, being sent, or with the server: not settled yet, one way or the other.
const isUnderWay = (status: UploadQueueItemStatusType) =>
  status === UploadQueueItemStatus.Waiting ||
  status === UploadQueueItemStatus.Uploading ||
  status === UploadQueueItemStatus.Processing

/**
 * The upload queue of a store: its queues as the store holds them, two uploads at a time per queue, the run of each
 * row, how a row leaves, and the settlement of the rows the server works on. Made in the setup of the store.
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

  // The runs still going, by their row as the core got it: a stop reaches a run also between its chunks.
  const stopHandles = new WeakMap<UploadQueueItem, () => void>()
  // The failed rows a refresh may still change, as the settlement tells them. Reactive, for the rows that show it.
  const refreshableRows = reactive(new WeakSet<UploadQueueItem>())

  const { hooks, ...settlementProfile } = profile
  const settlement = createUploadSettlement({
    ...settlementProfile,
    queues: () => queues.entries(),
    hooks: {
      ...hooks,
      onRowFinal: (queueKey, row) => {
        // Z26: the server takes a failed file nowhere, so what is left of it is not sent. Its place is free below,
        // and with the run stopped no third file goes out beside two.
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

  // A store disposed of leaves nothing behind: no timer of a poll, no listener for the tab or for the socket.
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

  // Into a queue that is not there: nothing, as for the counts below.
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
    let run: UploadRun<S> | undefined
    try {
      // Made here: a set that cannot make the run fails its row as a failed upload does. Thrown past this, it left
      // the row waiting, to be started and to throw again with every row after it.
      run = runnerFor(item, queueKey)(item, (progress, speed, estimate) => {
        setUploadSpeed(item, progress, speed, estimate)
      })
      stopHandles.set(item, run.stop)
      await run.uploadInit()
      await run.upload()
      stopHandles.delete(item)
      // Not a row its notification has settled meanwhile, nor a stopped one.
      if (item.status === UploadQueueItemStatus.Processing) track(queueKey, item)
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    } catch (error) {
      stopHandles.delete(item)
      // Stopped: it is gone from the queue, or the queue goes, and whatever stopped it started the next one. Uploaded:
      // the processed notification beat the answer to the finish request, and its settlement counted the queue.
      if (item.status === UploadQueueItemStatus.Stop || item.status === UploadQueueItemStatus.Uploaded) return
      // Failed before its request was. By the settlement, which stopped the run and counted the queue: the row keeps
      // the reason of the server, nothing is written over it and nothing told (Z26). Or by another run of the same
      // row: one that cannot be sent stays waiting while its hash loads, is started again, and the first of its runs
      // to fail has marked and counted it.
      if (item.status === UploadQueueItemStatus.Failed) return
      // Read before anything is written into the row: whether its reason was told already is among the failed rows.
      const failure = onClientFailure?.(queueKey, item, error)
      item.error.hasError = true
      if (failure) item.error.message = failure.message
      item.status = UploadQueueItemStatus.Failed
      // Its metadata event comes while the file still sends, and had enabled the form.
      item.canEditMetadata = false
      failure?.alert()
      // The finish request went out, so the server may complete the file all the same: the row is asked about for as
      // long as it stays in the queue. Not when the server answered that request with a refusal: it is sent once,
      // and a file the server has refused to finish it will not finish.
      if (run?.finishAttempted() && !isRefusal(error)) {
        track(queueKey, item, { clientFailed: true })
      }
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    }
  }

  // A row on its way, or one whose upload still runs although the server has settled it, is stopped: its run, also
  // between chunks, and the chunk on the wire. A settled row without a run stays as it is.
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
    // The poll of the queue no longer asks about it, nor does a read a notification asked for on its behalf.
    settlement.untrack(item)
    rowRemoved?.(queueKey, item)
    queue.items.splice(index, 1)
    recalculateQueueCounts(queueKey)
    // Its run, if any, ends without starting the next row: the place is free now.
    processUpload(queueKey)
  }

  function stopItemUpload(queueKey: UploadQueueKey, item: UploadQueueItem) {
    const queue = queues.get(queueKey)
    if (!queue || queue.items.length === 0) return
    item.status = UploadQueueItemStatus.Stop
    settlement.untrack(item)
    stopRun(item)
    // By identity: the position the caller saw the row at is another row's once the list has changed.
    const currentIndex = queue.items.indexOf(item)
    if (currentIndex > -1) removeByIndex(queueKey, currentIndex)
    processUpload(queueKey)
  }

  function stopUpload(queueKey: UploadQueueKey) {
    const queue = queues.get(queueKey)
    if (!queue) return
    if (queue.items.length === 0) {
      // Emptied row by row, the queue still has its idle poll: it goes with the queue.
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

  // Also of a queue that is not there: it is made, empty.
  function clearQueue(queueKey: UploadQueueKey) {
    queues.get(queueKey)?.items.forEach((item) => {
      rowRemoved?.(queueKey, item)
      stopRow(item)
    })
    // Before the queue is replaced: its rows are no longer asked about.
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
