import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DocId, DocIdNullable, IntegerId } from '@/types/common'
import { damFileTypeFix } from '@/components/file/composables/fileType'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/types/coreDam/UploadQueue'
import { useUploadQueueItemFactory } from '@/components/damImage/uploadQueue/composables/UploadQueueItemFactory'
import { getAssetTypeByMimeType } from '@/components/damImage/uploadQueue/composables/mimeTypeHelper'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { uploadStop, useUpload } from '@/components/damImage/uploadQueue/composables/uploadService'
import { DamAssetType } from '@/types/coreDam/Asset'
import type { AssetFileFailReason, AssetFileNullable } from '@/types/coreDam/AssetFile'
import { DamNotificationName } from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
import { useDamNotifications } from '@/components/damImage/uploadQueue/composables/damNotifications'
import { fetchAsset } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchImageFile } from '@/components/damImage/uploadQueue/api/damImageApi'
import { useAssetSuggestions } from '@/components/damImage/uploadQueue/composables/assetSuggestions'

const QUEUE_MAX_PARALLEL_UPLOADS = 2
const QUEUE_CHUNK_SIZE = 10485760

export const useUploadQueuesStore = defineStore('commonUploadQueuesStore', () => {
  const queues = ref<Map<UploadQueueKey, UploadQueue>>(new Map())

  const { createDefault } = useUploadQueueItemFactory()

  const { damClient } = useCommonAdminCoreDamOptions()
  const { addDamNotificationListener } = useDamNotifications()
  addDamNotificationListener((event) => {
    switch (event.name) {
      case DamNotificationName.AssetFileProcessed:
        queueItemProcessed(event.data.asset)
        break
      case DamNotificationName.AssetFileFailed:
        queueItemFailed(event.data.asset, event.data.failReason)
        break
      case DamNotificationName.AssetFileDuplicate:
        queueItemDuplicate(event.data.asset, event.data.originAssetFile, event.data.assetType)
        break
      case DamNotificationName.AssetMetadataProcessed:
        queueItemMetadataProcessed(event.data.asset)
        break
    }
  })

  function getQueue(queueKey: UploadQueueKey) {
    if (queues.value.has(queueKey)) {
      return queues.value.get(queueKey)
    }
    return null
  }

  function getQueueItems(queueKey: UploadQueueKey) {
    if (queues.value.has(queueKey)) {
      return queues.value.get(queueKey)?.items || []
    }
    return []
  }

  async function addByFiles(queueKey: UploadQueueKey, assetLicence: IntegerId, files: File[]) {
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
      createQueue(queueKey)
      addQueueItem(queueKey, queueItem)
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    }
  }

  function addQueueItem(queueKey: UploadQueueKey, item: UploadQueueItem) {
    const queue = queues.value.get(queueKey)
    if (!queue) return
    queue.items.push(item)
  }

  function createQueue(queueKey: UploadQueueKey) {
    if (!queues.value.has(queueKey)) {
      queues.value.set(queueKey, {
        items: [],
        totalCount: 0,
        processedCount: 0,
        fileInputKey: 0,
        suggestions: { newKeywordNames: new Set<string>(), newAuthorNames: new Set<string>() },
      })
    }
  }

  function recalculateQueueCounts(queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return
    queue.totalCount = queue.items.length
    queue.processedCount =
      getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Uploaded).length +
      getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Failed).length
  }

  function getQueueItemsByStatus(queueKey: UploadQueueKey, status: UploadQueueItemStatus) {
    const queue = queues.value.get(queueKey)
    if (!queue) return []
    return queue.items.filter((item) => item.status === status)
  }

  function processUpload(queueKey: UploadQueueKey) {
    const waitingItems = getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Waiting)
    if (waitingItems.length === 0) {
      // upload finished
      return
    }
    const uploadingCount = getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Uploading).length
    if (uploadingCount === QUEUE_MAX_PARALLEL_UPLOADS) {
      // wait for empty upload slot
      return
    }
    for (let i = 0; i < QUEUE_MAX_PARALLEL_UPLOADS; i++) {
      if (waitingItems[i]) queueItemUploadStart(waitingItems[i], queueKey)
    }
  }

  async function queueItemUploadStart(item: UploadQueueItem, queueKey: UploadQueueKey) {
    const { upload, uploadInit } = useUpload(item, (progress: number, speed: number, estimate: number) => {
      setUploadSpeed(item, progress, speed, estimate)
    })
    try {
      await uploadInit()
      await upload()
      processUpload(queueKey)
    } catch (e) {
      item.error.hasError = true
      item.status = UploadQueueItemStatus.Failed
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    }
  }

  function setUploadSpeed(item: UploadQueueItem, progress: number, speed: number, estimate: number) {
    item.progress.progressPercent = progress
    item.progress.remainingTime = estimate
    item.progress.speed = speed
  }

  async function queueItemProcessed(assetId: DocId) {
    try {
      const asset = await fetchAsset(damClient, assetId)
      if (!asset) return
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && asset.mainFile) {
            clearTimeout(item.notificationFallbackTimer)
            item.status = UploadQueueItemStatus.Uploaded
            item.assetStatus = asset.attributes.assetStatus
            if (asset.mainFile.links?.image_detail) {
              item.imagePreview = asset.mainFile.links.image_detail
            }
            processUpload(queueKey)
          }
        })
        recalculateQueueCounts(queueKey)
      })
    } catch (e) {
      //
    }
  }

  async function queueItemDuplicate(
    assetId: DocId,
    originAssetFile: DocIdNullable = null,
    assetType: DamAssetType | null = null
  ) {
    if (!originAssetFile || !assetType || assetType !== DamAssetType.Image) return
    let file: null | AssetFileNullable = null
    try {
      file = await fetchImageFile(damClient, originAssetFile)
    } catch (e) {
      //
    }
    queues.value.forEach((queue, queueKey) => {
      queue.items.forEach((item) => {
        if (item.assetId === assetId) {
          clearTimeout(item.notificationFallbackTimer)
          item.isDuplicate = true
          item.status = UploadQueueItemStatus.Uploaded
          item.canEditMetadata = false
          if (file) {
            item.fileId = file.id
            item.duplicateAssetId = file.asset
          }
          if (file?.links?.image_detail) {
            item.imagePreview = file.links.image_detail
          }
          processUpload(queueKey)
        }
      })
      recalculateQueueCounts(queueKey)
    })
  }

  async function queueItemFailed(assetId: DocId, failReason: AssetFileFailReason) {
    try {
      const asset = await fetchAsset(damClient, assetId)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id) {
            clearTimeout(item.notificationFallbackTimer)
            item.error.hasError = true
            item.status = UploadQueueItemStatus.Failed
            item.error.assetFileFailReason = failReason
            item.canEditMetadata = false
            processUpload(queueKey)
          }
        })
        recalculateQueueCounts(queueKey)
      })
    } catch (e) {
      //
    }
  }

  async function queueItemMetadataProcessed(assetId: DocId) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    try {
      const asset = await fetchAsset(damClient, assetId)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && item.type !== UploadQueueItemType.SlotFile) {
            item.keywords = asset.keywords
            item.authors = asset.authors
            item.customData = asset.metadata.customData
            updateNewNames(asset.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
            updateNewNames(asset.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
            item.authorConflicts = getAuthorConflicts(asset.metadata.authorSuggestions)
            item.canEditMetadata = true
            // TODO
            // addToCachedKeywords(item.keywords)
            // addToCachedAuthors(item.authors)
            // addToCachedAuthors(item.authorConflicts)
          }
        })
        recalculateQueueCounts(queueKey)
      })
    } catch (e) {
      //
    }
  }

  function removeByIndex (queueKey: UploadQueueKey, index: number) {}

  async function stopItemUpload(queueId: string, queueItem: UploadQueueItem, index: number) {

  }

  function getQueueTotalCount (queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return 0
    return queue.totalCount
  }

  function getQueueProcessedCount (queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return 0
    return queue.processedCount
  }

  function stopUpload (queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue || queue.items.length === 0) return
    const currentItems = getQueueItemsByStatus(queueKey, UploadQueueItemStatus.Uploading)
    queue.items.forEach((item) => {
      item.status = UploadQueueItemStatus.Stop
    })
    if (currentItems.length > 0) {
      currentItems.forEach((item) => {
        if (item.latestChunkCancelToken) {
          uploadStop(item.latestChunkCancelToken)
        }
      })
    }
    clearQueue(queueKey)
    forceReloadFileInput(queueKey)
  }

  function forceReloadFileInput (queueKey: UploadQueueKey) {
    createQueue(queueKey)
    const queue = queues.value.get(queueKey)
    if (!queue) return
    queue.fileInputKey++
  }

  function getQueueFileInputKey (queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return -1
    return queue.fileInputKey
  }

  function clearQueue(queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return
    queues.value.set(queueKey, {
      items: [],
      totalCount: 0,
      processedCount: 0,
      fileInputKey: getQueueFileInputKey(queueKey) + 1,
      suggestions: { newKeywordNames: new Set<string>(), newAuthorNames: new Set<string>() },
    })
  }

  function getQueueItemsTypes(queueKey: UploadQueueKey) {
      const types: Array<DamAssetType> = []
    const queue = queues.value.get(queueKey)
    if (!queue) return types
    if (queue.items.length > 0) {
      for (let i = 0; i < queue.items.length; i++) {
        if (types.includes(queue.items[i].assetType)) {
          continue
        }
        types.push(queue.items[i].assetType)
      }
    }
    return types
  }

  return {
    getQueue,
    getQueueItems,
    addByFiles,
    queueItemProcessed,
    queueItemDuplicate,
    queueItemFailed,
    removeByIndex,
    stopItemUpload,
    getQueueTotalCount,
    getQueueProcessedCount,
    stopUpload,
    getQueueItemsTypes,
  }
})
