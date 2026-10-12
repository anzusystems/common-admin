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
import { createUploadQueueCore, UPLOAD_QUEUE_ITEM_CHUNK_SIZE } from '@/domains/dam/uploadQueue/core/uploadQueueCore'
import type { UploadQueueSettlementProfile } from '@/domains/dam/uploadQueue/core/uploadQueueCoreTypes'
import { libraryQueuePreset } from '@/domains/dam/uploadQueue/presets/queuePresets'
import {
  type UploadReadOptions,
  type UploadRefreshOutcome,
  UploadRowRole,
  type UploadSettlementEvent,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { damFileTypeFix } from '@/domains/ui/file/utils/fileType'
import type { AxiosRequestConfig } from 'axios'
import type { DocId, DocIdNullable, IntegerId } from '@/shared/types/common'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { AssetFileFailReasonType } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { cloneDeep, isArray, isUndefined } from '@/shared/utils/common'
import { commonT } from '@/plugins/i18n'
import { defineStore } from 'pinia'
import { getCurrentScope, ref } from 'vue'

export const useUploadQueuesStore = defineStore('commonUploadQueuesStore', () => {
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()

  const queues = ref<Map<UploadQueueKey, UploadQueue>>(new Map())

  const { createDefault } = useUploadQueueItemFactory()

  // The DAM configuration each queue was made under: its files are sent, and its rows asked about, by the client
  // and at the addresses of that configuration. A queue the store was given no name for is under `default`.
  const configNames = new Map<UploadQueueKey, string>()
  const configOf = (queueKey?: UploadQueueKey) =>
    (isUndefined(queueKey) ? undefined : configNames.get(queueKey)) ?? 'default'
  // Read when a request is made, by the queue it is for.
  const damOf = (queueKey?: UploadQueueKey) => useCommonAdminCoreDamOptions(configOf(queueKey))

  // The poll asks for as long as a row waits: the settlement says of each of its requests whether a failure of it
  // is the first of a streak, and only that one is reported.

  // An asset that does not exist is an answer, which the settlement counts; anything else is a read that failed.
  const readAsset = async (assetId: DocId, options?: UploadReadOptions) => {
    const { damClient, endPointAsset } = damOf(options?.queueKey)
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
    const { damClient, endPointAsset } = damOf(options?.queueKey)
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
  // refresh button all go through here. The core counts the queue and starts the next row after a final state, and
  // keeps the failed rows a refresh may still change.
  const profile: UploadQueueSettlementProfile = {
    roleOf: (row) => (row.type === UploadQueueItemType.Asset ? UploadRowRole.Copy : UploadRowRole.Upload),
    policyFor: () => ({ reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' }),
    // By the asset alone, whatever the file an event names.
    matches: (row, target) => row.assetId === target.assetId,
    readers: {
      asset: readAsset,
      assets: readAssets,
      duplicateOriginAsset: async (originFileId, options) => {
        const { damClient, endPointAsset } = damOf(options?.queueKey)
        return fetchAssetByFileId(damClient, endPointAsset, originFileId)
      },
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
    connection: useDamNotificationsConnection(),
  }

  // Every row of this store is uploaded through the library's upload service. Made in the scope of the store: a
  // store disposed of leaves no timer of a poll, no listener for the tab or for the socket.
  const core = createUploadQueueCore(libraryQueuePreset({ queues, settlement: profile, configOf }))
  const { settlement } = core

  // The key of a queue is one widget's, and so of one configuration: a queue that has rows takes none under another
  // name. Refused, not sent under the name the queue has: that is not where the caller said. The queue is named
  // with its row, and nothing is awaited between the two: of two adds that overlap, the one whose row is in the
  // queue first has named it. The row starts at once, under that name.
  function addRowUnder(queueKey: UploadQueueKey, configName: string, item: UploadQueueItem) {
    const known = configNames.get(queueKey)
    if (!isUndefined(known) && known !== configName && core.getQueueItems(queueKey).length > 0) {
      throw new Error(
        `useUploadQueuesStore: the queue "${queueKey}" has rows under the DAM configuration "${known}", none is added under "${configName}".`
      )
    }
    configNames.set(queueKey, configName)
    core.addRow(queueKey, item)
  }

  const storeScope = getCurrentScope()

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

  async function addByCopyToLicence(
    queueKey: UploadQueueKey,
    extSystem: IntegerId,
    assetLicence: IntegerId,
    assets: DocId[],
    configName = 'default'
  ) {
    const { getDamConfigExtSystem } = useDamConfigState()

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByCopyToLicence: Ext system must be initialised.')
    }
    // Thrown here for a configuration the application has not got, before anything is done for it.
    useCommonAdminCoreDamOptions(configName)
    listenToNotifications()
    for (const assetId of assets) {
      const queueItem = createDefault(
        core.uniqueKey('asset_' + assetId),
        UploadQueueItemType.Asset,
        UploadQueueItemStatus.Processing,
        DamAssetType.Image, // only image now
        UPLOAD_QUEUE_ITEM_CHUNK_SIZE,
        assetLicence
      )
      queueItem.assetId = assetId
      addRowUnder(queueKey, configName, queueItem)
      // Nothing is uploaded here: the copy waits for the server from the start.
      const added = core.getQueueItems(queueKey).at(-1)
      if (added) core.track(queueKey, added)
    }
  }

  async function addByFiles(
    queueKey: UploadQueueKey,
    extSystem: IntegerId,
    assetLicence: IntegerId,
    files: File[],
    configName = 'default'
  ) {
    const { getDamConfigExtSystem } = useDamConfigState()

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByFiles: Ext system must be initialised.')
    }
    // Thrown here for a configuration the application has not got, before anything is done for it.
    useCommonAdminCoreDamOptions(configName)
    listenToNotifications()
    for await (const file of files) {
      const type = getAssetTypeByMimeType(damFileTypeFix(file), configExtSystem)
      if (!type || type !== DamAssetType.Image) continue // only image now
      const queueItem = createDefault(
        core.uniqueKey('file_' + file.name),
        UploadQueueItemType.File,
        UploadQueueItemStatus.Waiting,
        type,
        UPLOAD_QUEUE_ITEM_CHUNK_SIZE,
        assetLicence
      )
      queueItem.file = file
      queueItem.displayTitle = file.name
      addRowUnder(queueKey, configName, queueItem)
    }
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

  /** The refresh button of a row: asks what became of the file now, and settles the rows of the asset by it. */
  function refreshAsset(assetId: DocId): Promise<UploadRefreshOutcome> {
    return settlement.refreshAsset({ assetId, fileId: null })
  }

  async function stopItemUpload(queueKey: UploadQueueKey, queueItem: UploadQueueItem, _index?: number) {
    core.stopItemUpload(queueKey, queueItem)
  }

  /**
   * `configName`: the DAM configuration the detail was saved under. `mainFileSingleUse`: the switch the detail saved
   * with the asset, which keeps it apart from the asset it hands over.
   */
  async function updateFromDetail(asset: AssetDetailItemDto, configName?: string, mainFileSingleUse?: boolean | null) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    let dam: ReturnType<typeof useCommonAdminCoreDamOptions>
    try {
      dam = useCommonAdminCoreDamOptions(configName)
    } catch (e) {
      // The application has no configuration of that name: the rows are left alone, in silence, as ever.
      return
    }
    // The detail goes on telling the queue once it was opened from a row, also of an asset no queue holds a row of:
    // there is nothing to write then, and its save would wait for the read in vain.
    const hasRowOfAsset = Array.from(queues.value.values()).some((queue) =>
      queue.items.some((item) => item.assetId === asset.id && item.type)
    )
    if (!hasRowOfAsset) return
    try {
      const assetRes = await fetchAsset(dam.damClient, dam.endPointAsset, asset.id)
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
        core.recalculateQueueCounts(queueKey)
        fetchCachedAuthors()
        fetchCachedKeywords()
      })
    } catch (e) {
      // The detail is saved all the same: left as they were, the rows would send their old values with the next save
      // of the queue, over what the detail has just saved. Each row gets copies of its own, not the lists of the
      // detail. The suggestions are the server's to say, and stay as the rows have them.
      queues.value.forEach((queue) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && item.type) {
            item.keywords = [...asset.keywords]
            item.authors = [...asset.authors]
            item.customData = cloneDeep(asset.metadata.customData)
            if (!isUndefined(mainFileSingleUse)) item.mainFileSingleUse = mainFileSingleUse
            addToCachedKeywords(item.keywords)
            addToCachedAuthors(item.authors)
          }
        })
      })
      fetchCachedAuthors()
      fetchCachedKeywords()
    }
  }

  return {
    getQueue: core.getQueue,
    getQueueItems: core.getQueueItems,
    addByFiles,
    addByCopyToLicence,
    queueItemProcessed,
    queueItemFullyProcessed,
    queueItemDuplicate,
    queueItemFailed,
    refreshAsset,
    /**
     * Whether a refresh may still change a failed row: its finish request went out before the client gave it up and
     * the server has said nothing final about it since, or its file is a duplicate whose original could not be
     * read. A row that failed otherwise has no use for refresh.
     */
    refreshMayHelp: core.refreshMayHelp,
    removeByIndex: core.removeByIndex,
    stopItemUpload,
    getQueueTotalCount: core.getQueueTotalCount,
    getQueueProcessedCount: core.getQueueProcessedCount,
    stopUpload: core.stopUpload,
    getQueueItemsTypes: core.getQueueItemsTypes,
    updateFromDetail,
    forceReloadFileInput: core.forceReloadFileInput,
  }
})
