import {
  useCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { fetchAsset, fetchAssetByFileId } from '@/domains/dam/api/damAssetApi'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { useAssetSuggestions } from '@/domains/dam/uploadQueue/composables/assetSuggestions'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamNotifications } from '@/domains/dam/composables/damNotifications'
import { DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { getAssetTypeByMimeType } from '@/domains/dam/uploadQueue/utils/mimeTypeHelper'
import { uploadStop, useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { armNotificationFallback } from '@/domains/dam/api/uploadApi'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { damFileTypeFix } from '@/domains/ui/file/utils/fileType'
import type { DocId, DocIdNullable, IntegerId } from '@/shared/types/common'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import { AssetFileFailReasonDefault } from '@/domains/dam/types/AssetFile'
import type { AssetFileFailReasonType } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { isNull, isUndefined } from '@/shared/utils/common'
import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'

const QUEUE_MAX_PARALLEL_UPLOADS = 2
const QUEUE_CHUNK_SIZE = 10485760

export const useUploadQueuesStore = defineStore('commonUploadQueuesStore', () => {
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()

  const queues = ref<Map<UploadQueueKey, UploadQueue>>(new Map())
  // The rows that have been given their metadata. A failure takes the form of such a row away, not what the user
  // has typed into it.
  const metadataLoaded = new WeakSet<UploadQueueItem>()

  const { createDefault } = useUploadQueueItemFactory()

  const { damClient, endPointAsset } = useCommonAdminCoreDamOptions()
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
        UploadQueueItemStatus.Processing,
        DamAssetType.Image, // only image now
        QUEUE_CHUNK_SIZE,
        assetLicence
      )
      queueItem.assetId = assetId
      createQueue(queueKey)
      addQueueItem(queueKey, queueItem)
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
      // Nothing is uploaded here, so without the socket only the fallback can settle the copy.
      const added = getQueueItems(queueKey).at(-1)
      if (added && useCommonAdminCoreDamOptionsGlobal().uploadStatusFallback) {
        armNotificationFallback(damClient, endPointAsset, added)
      }
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
    const freeSlots = QUEUE_MAX_PARALLEL_UPLOADS - uploadingCount
    for (let i = 0; i < freeSlots; i++) {
      const item = waitingItems[i]
      if (item) queueItemUploadStart(item, queueKey)
    }
  }

  async function queueItemUploadStart(item: UploadQueueItem, queueKey: UploadQueueKey) {
    const { upload, uploadInit, stopSpeedCheck } = useUpload(
      item,
      (progress: number, speed: number, estimate: number) => {
        setUploadSpeed(item, progress, speed, estimate)
      }
    )
    try {
      await uploadInit()
      await upload()
      processUpload(queueKey)
    } catch (e) {
      stopSpeedCheck()
      // The processed notification can beat the answer to the finish request: a row it has settled stays
      // uploaded, whatever became of that request.
      if (item.status !== UploadQueueItemStatus.Uploaded) {
        item.error.hasError = true
        item.status = UploadQueueItemStatus.Failed
        // Its metadata event comes while the file still sends, and had enabled the form.
        item.canEditMetadata = false
      }
      recalculateQueueCounts(queueKey)
      processUpload(queueKey)
    }
  }

  function setUploadSpeed(item: UploadQueueItem, progress: number, speed: number, estimate: number) {
    item.progress.progressPercent = progress
    item.progress.remainingTime = estimate
    item.progress.speed = speed
  }

  // A row settled as uploaded shows no error: not the one the client gave up with, nor the fallback's.
  function clearError(item: UploadQueueItem) {
    item.error = { hasError: false, message: '', assetFileFailReason: AssetFileFailReasonDefault }
  }

  // A processed file for a row whose metadata may be missing as well: the fallback's and the refresh button's
  // load, a copy, and a row the client had given up on.
  function settleWithMetadata(
    queue: UploadQueue,
    queueKey: UploadQueueKey,
    item: UploadQueueItem,
    asset: AssetDetailItemDto,
    mainFile: NonNullable<AssetDetailItemDto['mainFile']>
  ) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    clearTimeout(item.notificationFallbackTimer)
    // status + image (from queueItemProcessed)
    item.status = UploadQueueItemStatus.Uploaded
    clearError(item)
    // A copy to the licence knows only its asset, and the image is built from the file id.
    if (isNull(item.fileId)) item.fileId = mainFile.id
    item.assetStatus = asset.attributes.assetStatus
    if (mainFile.links?.image_detail) {
      item.imagePreview = mainFile.links.image_detail
    }
    // metadata (from queueItemMetadataProcessed), loaded once: a row that has it keeps what the user has typed
    // since, also one that lost its form with a failure in between.
    if (!item.canEditMetadata) {
      if (!metadataLoaded.has(toRaw(item))) {
        item.keywords = asset.keywords
        item.authors = asset.authors
        item.customData = asset.metadata.customData
        item.mainFileSingleUse = asset.mainFileSingleUse
        item.mainFileInternal = asset.mainFileInternal
        updateNewNames(asset.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
        updateNewNames(asset.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
        item.authorConflicts = getAuthorConflicts(asset.metadata.authorSuggestions)
        addToCachedKeywords(item.keywords)
        addToCachedAuthors(item.authors)
        addToCachedAuthors(item.authorConflicts)
        metadataLoaded.add(toRaw(item))
      }
      item.canEditMetadata = true
    }
    processUpload(queueKey)
  }

  async function queueItemProcessed(assetId: DocId) {
    try {
      const asset = await fetchAsset(damClient, endPointAsset, assetId)
      if (!asset) return
      let givenUp = false
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && asset.mainFile) {
            // The client marks an upload failed when one of its requests fails, and the server may have finished
            // it all the same. Such a row lost its form with the failure, and gets it back with this answer: with
            // its metadata, when it had none before.
            // Read now, not before the lookup: that request can still fail while this one is on its way.
            if (item.status === UploadQueueItemStatus.Failed) {
              settleWithMetadata(queue, queueKey, item, asset, asset.mainFile)
              givenUp = true
              return
            }
            clearTimeout(item.notificationFallbackTimer)
            item.status = UploadQueueItemStatus.Uploaded
            clearError(item)
            item.assetStatus = asset.attributes.assetStatus
            if (asset.mainFile.links?.image_detail) {
              item.imagePreview = asset.mainFile.links.image_detail
            }
            // The switches of the row, until its metadata is loaded: after that the user may have set them.
            if (!item.canEditMetadata) {
              item.mainFileSingleUse = asset.mainFileSingleUse
              item.mainFileInternal = asset.mainFileInternal
            }
            processUpload(queueKey)
          }
        })
        recalculateQueueCounts(queueKey)
      })
      if (givenUp) {
        fetchCachedAuthors()
        fetchCachedKeywords()
      }
    } catch (e) {
      //
    }
  }

  async function queueItemFullyProcessed(assetId: DocId) {
    try {
      const asset = await fetchAsset(damClient, endPointAsset, assetId)
      if (!asset) return
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && asset.mainFile && item.type) {
            settleWithMetadata(queue, queueKey, item, asset, asset.mainFile)
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

  async function queueItemDuplicate(
    assetId: DocId,
    originAssetFile: DocIdNullable = null,
    assetType: DamAssetTypeType | null = null
  ) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    if (!originAssetFile || !assetType || assetType !== DamAssetType.Image) return
    let assetRes: null | AssetDetailItemDto = null
    try {
      assetRes = await fetchAssetByFileId(damClient, endPointAsset, originAssetFile)
    } catch (e) {
      // Every caller fires and forgets, a notification listener among them: a throw here is unhandled
      // and leaves the item processing for good.
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          // Only an item still waiting for this answer: another path (the notification or the fallback) may
          // have settled it meanwhile, and a settled item must not be flipped back to failed.
          if (item.assetId !== assetId || item.status !== UploadQueueItemStatus.Processing) return
          clearTimeout(item.notificationFallbackTimer)
          item.error.hasError = true
          item.status = UploadQueueItemStatus.Failed
          item.canEditMetadata = false
        })
        recalculateQueueCounts(queueKey)
      })
      return
    }
    queues.value.forEach((queue, queueKey) => {
      queue.items.forEach((item) => {
        if (isNull(assetRes)) return
        if (item.assetId === assetId) {
          clearTimeout(item.notificationFallbackTimer)
          item.isDuplicate = true
          item.status = UploadQueueItemStatus.Uploaded
          clearError(item)
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
          item.mainFileInternal = assetRes.mainFileInternal
          metadataLoaded.add(toRaw(item))
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
      const asset = await fetchAsset(damClient, endPointAsset, assetId)
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
      const asset = await fetchAsset(damClient, endPointAsset, assetId)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && item.type) {
            // A failed upload stays as it is: this event can come after the failure, and made the row editable again.
            if (item.status === UploadQueueItemStatus.Failed) return
            // Loaded once: a row that has its metadata keeps what the user has typed since.
            if (item.canEditMetadata) return
            item.keywords = asset.keywords
            item.authors = asset.authors
            item.customData = asset.metadata.customData
            item.mainFileSingleUse = asset.mainFileSingleUse
            item.mainFileInternal = asset.mainFileInternal
            updateNewNames(asset.metadata.authorSuggestions, queue.suggestions.newAuthorNames)
            updateNewNames(asset.metadata.keywordSuggestions, queue.suggestions.newKeywordNames)
            item.authorConflicts = getAuthorConflicts(asset.metadata.authorSuggestions)
            addToCachedKeywords(item.keywords)
            addToCachedAuthors(item.authors)
            addToCachedAuthors(item.authorConflicts)
            metadataLoaded.add(toRaw(item))
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
    try {
      const asset = await fetchAsset(damClient, endPointAsset, assetId)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && asset.mainFile && item.type) {
            // As the fallback settles it. Its metadata notification can come first, and its form with it: what the
            // user has typed since stays.
            settleWithMetadata(queue, queueKey, item, asset, asset.mainFile)
          }
        })
        recalculateQueueCounts(queueKey)
        fetchCachedAuthors()
        fetchCachedKeywords()
      })
    } catch (e) {
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId !== assetId || item.status !== UploadQueueItemStatus.Processing) return
          // The fallback poll would otherwise settle it later as uploaded.
          clearTimeout(item.notificationFallbackTimer)
          item.error.hasError = true
          item.status = UploadQueueItemStatus.Failed
          item.canEditMetadata = false
        })
        recalculateQueueCounts(queueKey)
      })
    }
  }

  // A removed item is stopped as a stopped upload is. The fallback reschedules itself for up to 550s, polling fetchAsset
  // and holding the File, and a poll already waiting for its fetch has no timer to clear: it stops at the status. An
  // upload still sending went on unseen, then was polled, and no longer counted against the parallel limit.
  function stopRemoved(item: UploadQueueItem) {
    clearTimeout(item.notificationFallbackTimer)
    const active: UploadQueueItemStatusType[] = [
      UploadQueueItemStatus.Waiting,
      UploadQueueItemStatus.Uploading,
      UploadQueueItemStatus.Processing,
    ]
    if (!active.includes(item.status)) return
    item.status = UploadQueueItemStatus.Stop
    if (item.latestChunkAbortController) uploadStop(item.latestChunkAbortController)
  }

  function removeByIndex(queueKey: UploadQueueKey, index: number) {
    const queue = queues.value.get(queueKey)
    if (!queue || !queue.items[index]) return
    stopRemoved(queue.items[index])
    queue.items.splice(index, 1)
    recalculateQueueCounts(queueKey)
  }

  async function stopItemUpload(queueKey: UploadQueueKey, queueItem: UploadQueueItem, index: number) {
    const queue = queues.value.get(queueKey)
    if (!queue || queue.items.length === 0) return
    queueItem.status = UploadQueueItemStatus.Stop
    if (queueItem.latestChunkAbortController) {
      uploadStop(queueItem.latestChunkAbortController)
    }
    removeByIndex(queueKey, index)
    processUpload(queueKey)
  }

  async function updateFromDetail(asset: AssetDetailItemDto) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    try {
      const assetRes = await fetchAsset(damClient, endPointAsset, asset.id)
      queues.value.forEach((queue, queueKey) => {
        queue.items.forEach((item) => {
          if (item.assetId === assetRes.id && item.type) {
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
        if (item.latestChunkAbortController) {
          uploadStop(item.latestChunkAbortController)
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
    queue.items.forEach((item) => clearTimeout(item.notificationFallbackTimer))
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
        if (types.includes(queue.items[i]!.assetType)) {
          continue
        }
        types.push(queue.items[i]!.assetType)
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
    queueItemFullyProcessed,
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
