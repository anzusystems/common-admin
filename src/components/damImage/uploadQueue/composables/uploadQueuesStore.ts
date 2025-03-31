import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAsset, fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useUploadQueueItemFactory } from '@/components/damImage/uploadQueue/composables/UploadQueueItemFactory'
import { useAssetSuggestions } from '@/components/damImage/uploadQueue/composables/assetSuggestions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useDamNotifications } from '@/components/damImage/uploadQueue/composables/damNotifications'
import { DamNotificationName } from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
import { getAssetTypeByMimeType } from '@/components/damImage/uploadQueue/composables/mimeTypeHelper'
import { uploadStop, useUpload } from '@/components/damImage/uploadQueue/composables/uploadService'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { damFileTypeFix } from '@/components/file/composables/fileType'
import type { DocId, DocIdNullable, IntegerId } from '@/types/common'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import type { AssetFileFailReasonType } from '@/types/coreDam/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/types/coreDam/UploadQueue'
import { isNull, isUndefined } from '@/utils/common'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const QUEUE_MAX_PARALLEL_UPLOADS = 2
const QUEUE_CHUNK_SIZE = 10485760

export const useUploadQueuesStore = defineStore('commonUploadQueuesStore', () => {
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()

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
      case DamNotificationName.AssetFileCopied:
        queueItemCopied(event.data.asset)
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

  async function addByCopyToLicence(
    queueKey: UploadQueueKey,
    extSystem: IntegerId,
    assetLicence: IntegerId,
    assets: DocId[]
  ) {
    const { getDamConfigExtSystem } = useDamConfigState()

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByCopyToLicence: Ext system must be initialised.')
    }
    for (const assetId of assets) {
      const queueItem = createDefault(
        'asset_' + assetId,
        UploadQueueItemType.Asset,
        UploadQueueItemStatus.Uploaded,
        DamAssetType.Image, // only image now
        QUEUE_CHUNK_SIZE,
        assetLicence
      )
      queueItem.assetId = assetId
      createQueue(queueKey)
      addQueueItem(queueKey, queueItem)
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    }
  }

  async function addByFiles(queueKey: UploadQueueKey, extSystem: IntegerId, assetLicence: IntegerId, files: File[]) {
    const { getDamConfigExtSystem } = useDamConfigState()

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByFiles: Ext system must be initialised.')
    }
    for await (const file of files) {
      const type = getAssetTypeByMimeType(damFileTypeFix(file), configExtSystem)
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

  function getQueueItemsByStatus(queueKey: UploadQueueKey, status: UploadQueueItemStatusType) {
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
            item.mainFileSingleUse = asset.mainFileSingleUse
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
    assetType: DamAssetTypeType | null = null
  ) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    if (!originAssetFile || !assetType || assetType !== DamAssetType.Image) return
    let assetRes: null | AssetDetailItemDto = null
    try {
      assetRes = await fetchAssetByFileId(damClient, originAssetFile)
    } catch (e) {
      throw new Error('Fatal error')
    }
    queues.value.forEach((queue, queueKey) => {
      queue.items.forEach((item) => {
        if (isNull(assetRes)) return
        if (item.assetId === assetId) {
          clearTimeout(item.notificationFallbackTimer)
          item.isDuplicate = true
          item.status = UploadQueueItemStatus.Uploaded
          item.fileId = originAssetFile
          item.duplicateAssetId = assetRes.id
          item.assetStatus = assetRes.attributes.assetStatus
          if (assetRes.mainFile?.links?.image_detail) {
            item.imagePreview = assetRes.mainFile.links.image_detail
          }
          item.keywords = assetRes.keywords
          item.authors = assetRes.authors
          item.customData = assetRes.metadata.customData
          updateNewNames(assetRes.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
          updateNewNames(assetRes.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
          item.authorConflicts = getAuthorConflicts(assetRes!.metadata.authorSuggestions)
          addToCachedKeywords(item.keywords)
          addToCachedAuthors(item.authors)
          addToCachedAuthors(item.authorConflicts)
          item.assetId = assetRes.id
          item.mainFileSingleUse = assetRes.mainFileSingleUse
          item.canEditMetadata = true
          processUpload(queueKey)
        }
      })
      recalculateQueueCounts(queueKey)
      fetchCachedAuthors()
      fetchCachedKeywords()
    })
  }

  async function queueItemFailed(assetId: DocId, failReason: AssetFileFailReasonType) {
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
          if (item.assetId === asset.id && item.type) {
            clearTimeout(item.notificationFallbackTimer)
            item.keywords = asset.keywords
            item.authors = asset.authors
            item.customData = asset.metadata.customData
            item.mainFileSingleUse = asset.mainFileSingleUse
            updateNewNames(asset.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
            updateNewNames(asset.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
            item.authorConflicts = getAuthorConflicts(asset.metadata.authorSuggestions)
            addToCachedKeywords(item.keywords)
            addToCachedAuthors(item.authors)
            addToCachedAuthors(item.authorConflicts)
            item.canEditMetadata = true
          }
        })
        recalculateQueueCounts(queueKey)
        fetchCachedAuthors()
        fetchCachedKeywords()
      })
    } catch (e) {
      //
    }
  }

  async function queueItemCopied(assetId: DocId) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    try {
      const asset = await fetchAsset(damClient, assetId)
      console.log(asset)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && asset.mainFile && item.type) {
            clearTimeout(item.notificationFallbackTimer)
            item.fileId = asset.mainFile.id
            item.status = UploadQueueItemStatus.Uploaded
            console.log(asset.attributes.assetStatus)
            item.assetStatus = asset.attributes.assetStatus
            if (asset.mainFile.links?.image_detail) {
              item.imagePreview = asset.mainFile.links.image_detail
            }
            item.mainFileSingleUse = asset.mainFileSingleUse
            item.keywords = asset.keywords
            item.authors = asset.authors
            item.customData = asset.metadata.customData
            updateNewNames(asset.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
            updateNewNames(asset.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
            item.authorConflicts = getAuthorConflicts(asset.metadata.authorSuggestions)
            addToCachedKeywords(item.keywords)
            addToCachedAuthors(item.authors)
            addToCachedAuthors(item.authorConflicts)
            item.canEditMetadata = true
            processUpload(queueKey)
          }
        })
        recalculateQueueCounts(queueKey)
        fetchCachedAuthors()
        fetchCachedKeywords()
      })
    } catch (e) {
      //
    }
  }

  function removeByIndex(queueKey: UploadQueueKey, index: number) {
    const queue = queues.value.get(queueKey)
    if (!queue || !queue.items[index]) return
    queue.items.splice(index, 1)
    recalculateQueueCounts(queueKey)
  }

  async function stopItemUpload(queueKey: UploadQueueKey, queueItem: UploadQueueItem, index: number) {
    const queue = queues.value.get(queueKey)
    if (!queue || queue.items.length === 0) return
    queueItem.status = UploadQueueItemStatus.Stop
    if (queueItem.latestChunkCancelToken) {
      uploadStop(queueItem.latestChunkCancelToken)
    }
    removeByIndex(queueKey, index)
    processUpload(queueKey)
  }

  async function updateFromDetail(asset: AssetDetailItemDto) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    try {
      const assetRes = await fetchAsset(damClient, asset.id)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === assetRes.id && item.type) {
            clearTimeout(item.notificationFallbackTimer)
            item.keywords = assetRes.keywords
            item.authors = assetRes.authors
            item.customData = assetRes.metadata.customData
            updateNewNames(assetRes.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
            updateNewNames(assetRes.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
            item.authorConflicts = getAuthorConflicts(assetRes.metadata.authorSuggestions)
            addToCachedKeywords(item.keywords)
            addToCachedAuthors(item.authors)
            addToCachedAuthors(item.authorConflicts)
          }
        })
        recalculateQueueCounts(queueKey)
        fetchCachedAuthors()
        fetchCachedKeywords()
      })
    } catch (e) {
      //
    }
  }

  function getQueueTotalCount(queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return 0
    return queue.totalCount
  }

  function getQueueProcessedCount(queueKey: UploadQueueKey) {
    const queue = queues.value.get(queueKey)
    if (!queue) return 0
    return queue.processedCount
  }

  function stopUpload(queueKey: UploadQueueKey) {
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

  function forceReloadFileInput(queueKey: UploadQueueKey) {
    createQueue(queueKey)
    const queue = queues.value.get(queueKey)
    if (!queue) return
    queue.fileInputKey++
  }

  function getQueueFileInputKey(queueKey: UploadQueueKey) {
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
    const types: Array<DamAssetTypeType> = []
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
    addByCopyToLicence,
    queueItemProcessed,
    queueItemDuplicate,
    queueItemFailed,
    removeByIndex,
    stopItemUpload,
    getQueueTotalCount,
    getQueueProcessedCount,
    stopUpload,
    getQueueItemsTypes,
    updateFromDetail,
    forceReloadFileInput,
  }
})
