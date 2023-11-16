import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DocId, IntegerId } from '@/types/common'
import { damFileTypeFix } from '@/components/file/composables/fileType'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/types/coreDam/UploadQueue'
import { useUploadQueueItemFactory } from '@/components/dam/uploadQueue/UploadQueueItemFactory'
import { getAssetTypeByMimeType } from '@/components/dam/uploadQueue/mimeTypeHelper'
import { useDamConfigState } from '@/components/dam/uploadQueue/damConfigState'
import { useUpload } from '@/components/dam/uploadQueue/uploadService'
import { DamAssetType } from '@/types/coreDam/Asset'
import type { AssetFileFailReason } from '@/types/coreDam/AssetFile'

const QUEUE_MAX_PARALLEL_UPLOADS = 2
const QUEUE_CHUNK_SIZE = 10485760

export const useUploadQueuesStore = defineStore('commonUploadQueuesStore', () => {
  const queues = ref<Map<UploadQueueKey, UploadQueue>>(new Map())

  const { createDefault } = useUploadQueueItemFactory()

  function getQueue(queueId: UploadQueueKey) {
    if (queues.value.has(queueId)) {
      return queues.value.get(queueId)
    }
    return null
  }

  function getQueueItems(queueId: UploadQueueKey) {
    if (queues.value.has(queueId)) {
      return queues.value.get(queueId)?.items || []
    }
    return []
  }

  async function addByFiles(queueId: UploadQueueKey, assetLicence: IntegerId, files: File[]) {
    const { damConfigExtSystem } = useDamConfigState()
    for await (const file of files) {
      const type = getAssetTypeByMimeType(damFileTypeFix(file), damConfigExtSystem.value)
      if (!type || type !== DamAssetType.Image) continue // only image now
      const queueItem = createDefault(
        'file_' + file.name,
        UploadQueueItemType.File,
        UploadQueueItemStatus.Waiting,
        type,
        QUEUE_CHUNK_SIZE,
        assetLicence
      )
      queueItem.file = file
      queueItem.displayTitle = file.name
      createQueue(queueId)
      addQueueItem(queueId, queueItem)
      recalculateQueueCounts(queueId)
      processUpload(queueId)
    }
  }

  function addQueueItem(queueId: UploadQueueKey, item: UploadQueueItem) {
    const queue = queues.value.get(queueId)
    if (!queue) return
    queue.items.push(item)
  }

  function createQueue(queueId: UploadQueueKey) {
    if (!queues.value.has(queueId)) {
      queues.value.set(queueId, {
        items: [],
        totalCount: 0,
        processedCount: 0,
        fileInputKey: 0,
        suggestions: { newKeywordNames: new Set<string>(), newAuthorNames: new Set<string>() },
      })
    }
  }

  function recalculateQueueCounts(queueId: UploadQueueKey) {
    const queue = queues.value.get(queueId)
    if (!queue) return
    queue.totalCount = queue.items.length
    queue.processedCount =
      getQueueItemsByStatus(queueId, UploadQueueItemStatus.Uploaded).length +
      getQueueItemsByStatus(queueId, UploadQueueItemStatus.Failed).length
  }

  function getQueueItemsByStatus(queueId: UploadQueueKey, status: UploadQueueItemStatus) {
    const queue = queues.value.get(queueId)
    if (!queue) return []
    return queue.items.filter((item) => item.status === status)
  }

  function processUpload(queueId: UploadQueueKey) {
    const waitingItems = getQueueItemsByStatus(queueId, UploadQueueItemStatus.Waiting)
    if (waitingItems.length === 0) {
      //upload finished
      return
    }
    const uploadingCount = getQueueItemsByStatus(queueId, UploadQueueItemStatus.Uploading).length
    if (uploadingCount === QUEUE_MAX_PARALLEL_UPLOADS) {
      // wait for empty upload slot
      return
    }
    for (let i = 0; i < QUEUE_MAX_PARALLEL_UPLOADS; i++) {
      if (waitingItems[i]) queueItemUploadStart(waitingItems[i], queueId)
    }
  }

  async function queueItemUploadStart(item: UploadQueueItem, queueId: string) {
    const { upload, uploadInit } = useUpload(item, (progress: number, speed: number, estimate: number) => {
      setUploadSpeed(item, progress, speed, estimate)
    })
    try {
      await uploadInit()
      await upload()
      processUpload(queueId)
    } catch (e) {
      item.error.hasError = true
      item.status = UploadQueueItemStatus.Failed
      recalculateQueueCounts(queueId)
      processUpload(queueId)
    }
  }

  function setUploadSpeed(item: UploadQueueItem, progress: number, speed: number, estimate: number) {
    item.progress.progressPercent = progress
    item.progress.remainingTime = estimate
    item.progress.speed = speed
  }

  function queueItemProcessed (assetId: DocId) {}
  function queueItemDuplicate (assetId: DocId) {}
  function queueItemFailed (assetId: DocId, failReason: AssetFileFailReason) {}

  return {
    getQueue,
    getQueueItems,
    addByFiles,
    queueItemProcessed,
    queueItemDuplicate,
    queueItemFailed,
  }
})
