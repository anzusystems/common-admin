import { requestedUrl } from '@/domains/api/composables/request'
import { apiErrorStatus, mapApiError, report } from '@/domains/api/utils/apiErrors'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { ENTITY, fetchAsset, fetchAssetByFileId, fetchAssetListByIds } from '@/domains/dam/api/damAssetApi'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { useAssetSuggestions } from '@/domains/dam/uploadQueue/composables/assetSuggestions'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsConnection } from '@/domains/dam/composables/damNotificationsConnection'
import { type DamNotification, DamNotificationName } from '@/domains/dam/composables/damNotificationsEventBus'
import { getAssetTypeByMimeType } from '@/domains/dam/uploadQueue/utils/mimeTypeHelper'
import { uploadStop, useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { createUploadSettlement } from '@/domains/dam/uploadQueue/settlement/uploadSettlement'
import {
  type UploadReadOptions,
  type UploadRefreshOutcome,
  UploadRowRole,
  type UploadSettlementEvent,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { damFileTypeFix } from '@/domains/ui/file/utils/fileType'
import axios, { type AxiosRequestConfig } from 'axios'
import type { DocId, DocIdNullable, IntegerId } from '@/shared/types/common'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { AssetFileFailReasonType } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { isArray, isUndefined } from '@/shared/utils/common'
import { commonT } from '@/plugins/i18n'
import { defineStore } from 'pinia'
import { getCurrentScope, onScopeDispose, reactive, ref, toRaw } from 'vue'

const QUEUE_MAX_PARALLEL_UPLOADS = 2
const QUEUE_CHUNK_SIZE = 10485760

// An answer of the server that says no (4xx). The requests of an upload reject with the error of axios as it is.
const isRefusal = (error: unknown) => {
  const status = axios.isAxiosError(error) ? error.response?.status : apiErrorStatus(error)

  return !isUndefined(status) && status >= 400 && status < 500
}

// A file name is not unique, nor is an asset added twice: rows that share a `:key` have Vue patch the wrong one.
let queueItemSequence = 0
const uniqueQueueItemKey = (prefix: string) => `${prefix}_${++queueItemSequence}`

export const useUploadQueuesStore = defineStore('commonUploadQueuesStore', () => {
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()

  const queues = ref<Map<UploadQueueKey, UploadQueue>>(new Map())
  // The failed rows a refresh may still change, as the settlement tells them: given up by the client after their
  // finish request went out and asked about since, or left without the original of their duplicate. Reactive,
  // for the rows that show it.
  const refreshable = reactive(new WeakSet<UploadQueueItem>())

  const { createDefault } = useUploadQueueItemFactory()

  const { damClient, endPointAsset } = useCommonAdminCoreDamOptions()

  // The poll asks for as long as a row waits: the settlement says of each of its requests whether a failure of it
  // is the first of a streak, and only that one is reported.

  // An asset that does not exist is an answer, which the settlement counts; anything else is a read that failed.
  const readAsset = async (assetId: DocId, options?: UploadReadOptions) => {
    try {
      // Called as ever unless it is to be quiet.
      return options?.report === false
        ? await fetchAsset(damClient, endPointAsset, assetId, { report: false })
        : await fetchAsset(damClient, endPointAsset, assetId)
    } catch (error) {
      if (apiErrorStatus(error) === 404) return null
      throw error
    }
  }

  // The list goes to the client as it is, and reports nothing by itself.
  const readAssets = async (licenceId: IntegerId, assetIds: DocId[], options?: UploadReadOptions) => {
    try {
      return await fetchAssetListByIds(damClient, endPointAsset, assetIds, licenceId)
    } catch (failure) {
      if (options?.report) {
        // An answer that carries no list of assets is rejected as the answers themselves.
        const answer = isArray<{ status?: number; config?: AxiosRequestConfig }>(failure) ? failure.at(-1) : undefined
        const url = `${endPointAsset}/licence/${licenceId}/ids/${assetIds.join(',')}`
        const context = {
          system: SYSTEM_CORE_DAM,
          entity: ENTITY,
          // As the request went out, with the address of the client, when axios has kept it.
          url: requestedUrl(damClient, url, {}, failure, answer?.config),
        }
        const error = isArray(failure) ? new AnzuApiResponseCodeError(answer?.status ?? 0) : failure
        report(mapApiError(error, context), context)
      }
      throw failure
    }
  }

  // What becomes of a row once its file is with the server: the poll of its queue, the notifications and the
  // refresh button all go through here.
  const settlement = createUploadSettlement({
    queues: () => queues.value.entries(),
    roleOf: (row) => (row.type === UploadQueueItemType.Asset ? UploadRowRole.Copy : UploadRowRole.Upload),
    policyFor: () => ({ reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' }),
    // By the asset alone, whatever the file an event names.
    matches: (row, target) => row.assetId === target.assetId,
    readers: {
      asset: readAsset,
      assets: readAssets,
      duplicateOriginAsset: (originFileId) => fetchAssetByFileId(damClient, endPointAsset, originFileId),
    },
    caches: {
      addAuthors: addToCachedAuthors,
      addKeywords: addToCachedKeywords,
      fetchAuthors: fetchCachedAuthors,
      fetchKeywords: fetchCachedKeywords,
    },
    messages: {
      processingTooLong: () => commonT('common.damImage.uploadErrors.processingTooLong'),
      readFailed: () => commonT('common.damImage.uploadErrors.readFailed'),
      assetMissing: () => commonT('common.damImage.uploadErrors.unknownError'),
    },
    hooks: {
      onRowFinal: (queueKey) => {
        recalculateQueueCounts(queueKey)
        processUpload(queueKey)
      },
      onRefreshMayHelp: (_queueKey, row, mayHelp) => {
        if (mayHelp) refreshable.add(toRaw(row))
        else refreshable.delete(toRaw(row))
      },
    },
    connection: useDamNotificationsConnection(),
  })

  const storeScope = getCurrentScope()
  // A store disposed of leaves nothing behind: no timer of a poll, no listener for the tab or for the socket.
  if (storeScope) onScopeDispose(() => settlement.dispose())

  // Without the file a notification names: the rows are matched by their asset alone, and a read asked for
  // about a file that is not the main one would take the state of that file from the notification unchecked.
  const toSettlementEvent = (event: DamNotification): UploadSettlementEvent | null => {
    switch (event.name) {
      case DamNotificationName.AssetFileProcessed:
        return { kind: 'processed', assetId: event.data.asset, fileId: null }
      case DamNotificationName.AssetFileFailed:
        return { kind: 'failed', assetId: event.data.asset, fileId: null, failReason: event.data.failReason }
      case DamNotificationName.AssetFileDuplicate:
        return {
          kind: 'duplicate',
          assetId: event.data.asset,
          fileId: null,
          originAssetFile: event.data.originAssetFile,
          assetType: event.data.assetType,
        }
      case DamNotificationName.AssetMetadataProcessed:
        return { kind: 'metadata', assetId: event.data.asset, fileId: null }
      case DamNotificationName.AssetFileCopied:
        return { kind: 'copied', assetId: event.data.asset, fileId: null }
    }
    return null
  }

  const { addDamNotificationListener } = useDamNotifications()
  // With its first row, not with the store: an application with a queue store of its own keeps this one alive
  // too, and both would answer every notification. Never taken back.
  let listening = false
  function listenToNotifications() {
    if (listening) return
    listening = true
    const listen = () =>
      addDamNotificationListener((event) => {
        const settlementEvent = toSettlementEvent(event)
        // Not awaited: the read it asks for comes later.
        if (settlementEvent) void settlement.notify(settlementEvent)
      })
    // In the scope of the store, as when the store itself subscribed. The first row is added from a component, and
    // a listener added in the scope of that component would go with it.
    if (storeScope) storeScope.run(listen)
    else listen()
  }

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
    listenToNotifications()
    for (const assetId of assets) {
      const queueItem = createDefault(
        uniqueQueueItemKey('asset_' + assetId),
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
      // Nothing is uploaded here: the copy waits for the server from the start.
      const added = getQueueItems(queueKey).at(-1)
      if (added) settlement.track(queueKey, added)
    }
  }

  async function addByFiles(queueKey: UploadQueueKey, extSystem: IntegerId, assetLicence: IntegerId, files: File[]) {
    const { getDamConfigExtSystem } = useDamConfigState()

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByFiles: Ext system must be initialised.')
    }
    listenToNotifications()
    for await (const file of files) {
      const type = getAssetTypeByMimeType(damFileTypeFix(file), configExtSystem)
      if (!type || type !== DamAssetType.Image) continue // only image now
      const queueItem = createDefault(
        uniqueQueueItemKey('file_' + file.name),
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
    const { upload, uploadInit, stopSpeedCheck, finishAttempted } = useUpload(
      item,
      (progress: number, speed: number, estimate: number) => {
        setUploadSpeed(item, progress, speed, estimate)
      }
    )
    try {
      await uploadInit()
      await upload()
      // Not a row its notification has settled meanwhile, nor a stopped one.
      if (item.status === UploadQueueItemStatus.Processing) settlement.track(queueKey, item)
      processUpload(queueKey)
    } catch (e) {
      stopSpeedCheck()
      // Failed before its request was: only its notification does that, and the server takes a failed file
      // nowhere from there.
      const failedByServer = item.status === UploadQueueItemStatus.Failed
      // The processed notification can beat the answer to the finish request: a row it has settled stays
      // uploaded, whatever became of that request.
      if (item.status !== UploadQueueItemStatus.Uploaded) {
        item.error.hasError = true
        item.status = UploadQueueItemStatus.Failed
        // Its metadata event comes while the file still sends, and had enabled the form.
        item.canEditMetadata = false
      }
      // The finish request went out, so the server may complete the file all the same: the row is asked about
      // for as long as it stays in the queue. Not when the server answered that request with a refusal: it is
      // sent once, and a file the server has refused to finish it will not finish.
      if (finishAttempted() && !failedByServer && !isRefusal(e) && item.status === UploadQueueItemStatus.Failed) {
        settlement.track(queueKey, item, { clientFailed: true })
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

  // The names of before the settlement, kept for their callers until the queues are unified.

  function queueItemProcessed(assetId: DocId) {
    return settlement.notify({ kind: 'processed', assetId, fileId: null })
  }

  function queueItemFullyProcessed(assetId: DocId) {
    return settlement.settleKnownProcessed({ assetId, fileId: null }, { withMetadata: true })
  }

  function queueItemDuplicate(
    assetId: DocId,
    originAssetFile: DocIdNullable = null,
    assetType: DamAssetTypeType | null = null
  ) {
    return settlement.settleKnownDuplicate({ assetId, fileId: null }, originAssetFile, assetType)
  }

  async function queueItemFailed(assetId: DocId, failReason: AssetFileFailReasonType) {
    settlement.settleKnownFailed({ assetId, fileId: null }, failReason)
  }

  /**
   * Whether a refresh may still change a failed row: its finish request went out before the client gave it up and
   * the server has said nothing final about it since, or its file is a duplicate whose original could not be
   * read. A row that failed otherwise has no use for refresh.
   */
  function refreshMayHelp(item: UploadQueueItem) {
    return item.status === UploadQueueItemStatus.Failed && refreshable.has(toRaw(item))
  }

  /** The refresh button of a row: asks what became of the file now, and settles the rows of the asset by it. */
  function refreshAsset(assetId: DocId): Promise<UploadRefreshOutcome> {
    return settlement.refreshAsset({ assetId, fileId: null })
  }

  // A removed item is stopped as a stopped upload is: the poll no longer asks about it, and a read already on its
  // way finds it gone. An upload still sending went on unseen, then was polled, and no longer counted against the
  // parallel limit.
  function stopRemoved(item: UploadQueueItem) {
    settlement.untrack(item)
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

  async function stopItemUpload(queueKey: UploadQueueKey, queueItem: UploadQueueItem, _index?: number) {
    const queue = queues.value.get(queueKey)
    if (!queue || queue.items.length === 0) return
    queueItem.status = UploadQueueItemStatus.Stop
    if (queueItem.latestChunkAbortController) {
      uploadStop(queueItem.latestChunkAbortController)
    }
    // By identity: the position the caller saw the row at is another row's once the list has changed.
    const currentIndex = queue.items.indexOf(queueItem)
    if (currentIndex > -1) removeByIndex(queueKey, currentIndex)
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
            // The detail saves it too: left as it was, the next save of the queue would send the old value.
            item.mainFileSingleUse = assetRes.mainFileSingleUse
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
    if (!queue) return
    if (queue.items.length === 0) {
      // Emptied row by row, the queue still has its idle poll: it goes with the queue.
      settlement.dropQueue(queueKey)
      return
    }
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
    // Before the queue is replaced: its rows are no longer asked about.
    settlement.dropQueue(queueKey)
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
    refreshAsset,
    refreshMayHelp,
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
