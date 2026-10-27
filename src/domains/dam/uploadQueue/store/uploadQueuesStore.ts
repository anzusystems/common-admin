import { requestedUrl } from '@/domains/api/composables/request'
import { apiErrorIsReported, apiErrorStatus, mapApiError, report } from '@/domains/api/utils/apiErrors'
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
import { cloneDeep, isArray, isString, isUndefined } from '@/shared/utils/common'
import { commonT } from '@/plugins/i18n'
import { defineStore } from 'pinia'
import { getCurrentScope, ref } from 'vue'

/**
 * Fields the user edits and a detail save writes.
 */
export interface EditableFields {
  keywords: DocId[]
  authors: DocId[]
  customData: UploadQueueItem['customData']
  mainFileSingleUse: boolean | null | undefined
}

const editableFieldsOf = (item: UploadQueueItem): EditableFields =>
  cloneDeep({
    keywords: item.keywords,
    authors: item.authors,
    customData: item.customData,
    mainFileSingleUse: item.mainFileSingleUse,
  })

const sameValue = (one: unknown, other: unknown) => JSON.stringify(one) === JSON.stringify(other)

/**
 * Field-by-field snapshot of an asset's rows (`noteRowsOfAsset`).
 */
export interface RowsNote {
  assetId: DocId
  /**
   * DAM configuration of the queues the rows are in.
   */
  configName: string
  rows: Map<UploadQueueItem, EditableFields>
}

/**
 * Which rows a settle function targets: queues of the named DAM configuration, or of the configuration of `queueKey`.
 * Required because two DAMs may share an asset id.
 */
export type UploadQueueRowsOf = string | { queueKey: UploadQueueKey }

/**
 * What a write left as the user had changed it: these fields and these custom data keys.
 */
interface KeptByWrite {
  fields: Set<'keywords' | 'authors' | 'mainFileSingleUse'>
  customKeys: Set<string>
}

/**
 * Writes the saved detail into a row of its asset. Each row gets its own copies.
 * A field the user changed since `was` (the row when save was pressed)
 * keeps the user's value. Custom data keys are compared one by one.
 * A row unknown to `was` (it became a row of the asset meanwhile)
 * takes everything. `mainFileSingleUse` undefined is left as is.
 * Returns what it kept.
 */
const writeUnchanged = (item: UploadQueueItem, was: EditableFields | undefined, saved: EditableFields) => {
  const kept: KeptByWrite = { fields: new Set(), customKeys: new Set() }
  const unchanged = (field: 'keywords' | 'authors' | 'mainFileSingleUse') => {
    if (!was || sameValue(item[field], was[field])) return true
    kept.fields.add(field)
    return false
  }
  if (unchanged('keywords')) item.keywords = [...saved.keywords]
  if (unchanged('authors')) item.authors = [...saved.authors]
  const customData = cloneDeep(saved.customData)
  if (was && customData) {
    const now = item.customData ?? {}
    const then = was.customData ?? {}
    new Set([...Object.keys(now), ...Object.keys(then)]).forEach((key) => {
      if (sameValue(now[key], then[key])) return
      kept.customKeys.add(key)
      if (key in now) customData[key] = cloneDeep(now[key])
      else delete customData[key]
    })
  }
  item.customData = customData
  if (isUndefined(saved.mainFileSingleUse)) kept.fields.add('mainFileSingleUse')
  else if (unchanged('mainFileSingleUse')) item.mainFileSingleUse = saved.mainFileSingleUse
  return kept
}

/**
 * Another pending save of the same asset takes over what a write just put into `item`.
 * That value is not a user change. Otherwise the later save would keep the earlier save's values.
 */
const takeWrite = (note: RowsNote, item: UploadQueueItem, kept: KeptByWrite) => {
  const entry = note.rows.get(item)
  if (!entry) return
  if (!kept.fields.has('keywords')) entry.keywords = [...item.keywords]
  if (!kept.fields.has('authors')) entry.authors = [...item.authors]
  if (!kept.fields.has('mainFileSingleUse')) entry.mainFileSingleUse = item.mainFileSingleUse
  const written = item.customData ?? {}
  const noted = (entry.customData = { ...entry.customData })
  new Set([...Object.keys(written), ...Object.keys(noted)]).forEach((key) => {
    if (kept.customKeys.has(key)) return
    if (key in written) noted[key] = cloneDeep(written[key])
    else delete noted[key]
  })
}

export const useUploadQueuesStore = defineStore('commonAdminUploadQueuesStore', () => {
  const queues = ref<Map<UploadQueueKey, UploadQueue>>(new Map())

  const { createDefault } = useUploadQueueItemFactory()

  // The DAM configuration each queue was created under. Its files are sent
  // and its rows read with that configuration's client and endpoints.
  // A queue without a given name uses `default`.
  const configNames = new Map<UploadQueueKey, string>()
  const configOf = (queueKey?: UploadQueueKey) =>
    (isUndefined(queueKey) ? undefined : configNames.get(queueKey)) ?? 'default'
  // Resolved per request, from the queue it is for.
  const damOf = (queueKey?: UploadQueueKey) => useCommonAdminCoreDamOptions(configOf(queueKey))

  // The poll repeats while a row waits. The settlement decides per request
  // whether a failure starts a streak, and only that one is reported.

  // A missing asset is an answer the settlement counts. Anything else is a failed read.
  const readAsset = async (assetId: DocId, options?: UploadReadOptions) => {
    const { damClient, endPointAsset } = damOf(options?.queueKey)
    try {
      return options?.report === false
        ? await fetchAsset(damClient, endPointAsset, assetId, { report: false })
        : await fetchAsset(damClient, endPointAsset, assetId)
    } catch (error) {
      if (apiErrorStatus(error) === 404) return null
      throw error
    }
  }

  // The list request reports nothing by itself. A reported failure is
  // rethrown as reported, so the settlement can check whether it was logged.
  const readAssets = async (licenceId: IntegerId, assetIds: DocId[], options?: UploadReadOptions) => {
    const { damClient, endPointAsset } = damOf(options?.queueKey)
    try {
      return await fetchAssetListByIds(damClient, endPointAsset, assetIds, licenceId)
    } catch (failure) {
      if (options?.report) {
        // An answer without an asset list is rejected like the failed answers.
        const answer = isArray<{ status?: number; config?: AxiosRequestConfig }>(failure) ? failure.at(-1) : undefined
        const url = `${endPointAsset}/licence/${licenceId}/ids/${assetIds.join(',')}`
        const context = {
          system: SYSTEM_CORE_DAM,
          entity: ENTITY,
          // The URL as sent, with the client's base address, when axios kept the config.
          url: requestedUrl(damClient, url, {}, failure, answer?.config),
        }
        const error = isArray(failure) ? new AnzuApiResponseCodeError(answer?.status ?? 0) : failure
        throw report(mapApiError(error, context), context)
      }
      throw failure
    }
  }

  // Handles a row once its file is on the server. The queue poll,
  // notifications and the refresh button all go through here.
  // The core counts the queue, starts the next row after a final
  // state, and keeps failed rows a refresh may still change.
  const profile: UploadQueueSettlementProfile = {
    roleOf: (row) => (row.type === UploadQueueItemType.Asset ? UploadRowRole.Copy : UploadRowRole.Upload),
    policyFor: () => ({ reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' }),
    // Matched by asset only, whatever file an event names.
    matches: (row, target) => row.assetId === target.assetId,
    readers: {
      asset: readAsset,
      assets: readAssets,
      duplicateOriginAsset: async (originFileId, options) => {
        const { damClient, endPointAsset } = damOf(options?.queueKey)
        return fetchAssetByFileId(damClient, endPointAsset, originFileId)
      },
      failureReported: apiErrorIsReported,
    },
    // Two DAMs may use the same asset id, so rows are settled only within the queues of their configuration.
    configOf,
    // Names of a queue's rows come from the DAM of its configuration.
    caches: {
      addAuthors: (ids, queueKey) => useDamCachedAuthors(configOf(queueKey)).addToCachedAuthors(ids),
      addKeywords: (ids, queueKey) => useDamCachedKeywords(configOf(queueKey)).addToCachedKeywords(ids),
      fetchAuthors: (queueKey) => useDamCachedAuthors(configOf(queueKey)).fetchCachedAuthors(),
      fetchKeywords: (queueKey) => useDamCachedKeywords(configOf(queueKey)).fetchCachedKeywords(),
    },
    messages: {
      processingTooLong: () => commonT('common.damImage.uploadErrors.processingTooLong'),
      readFailed: () => commonT('common.damImage.uploadErrors.readFailed'),
      assetMissing: () => commonT('common.damImage.uploadErrors.unknownError'),
      assetGone: () => commonT('common.damImage.queueItem.assetGone'),
    },
    // Uses the socket of the queue's configuration. A configuration without a socket is polled more often.
    connection: {
      isPushAlive: (queueKey) => useDamNotificationsConnection(configOf(queueKey)).isPushAlive(),
      onChange: useDamNotificationsConnection().onChange,
    },
  }

  // Created in the store's scope, so a disposed store leaves no poll timer and no tab or socket listener.
  const core = createUploadQueueCore(libraryQueuePreset({ queues, settlement: profile, configOf }))
  const { settlement } = core

  // A queue key belongs to one widget and so to one configuration. A queue with
  // rows refuses another configuration name instead of sending under its own.
  // The name is set together with the row, with no await in between.
  // Of two overlapping adds, the first row in the queue sets the name.
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

  // The file a notification names is dropped. Rows match by asset only,
  // and a read for a non-main file would take that file's state unchecked.
  // `configNames`: configurations of the socket it came through. Only their queues are affected.
  const toSettlementEvent = (event: DamNotification, configNames: string[]): UploadSettlementEvent | null => {
    switch (event.name) {
      case DamNotificationName.AssetFileProcessed:
        return { kind: 'processed', assetId: event.data.asset, fileId: null, configNames }
      case DamNotificationName.AssetFileFailed:
        return {
          kind: 'failed',
          assetId: event.data.asset,
          fileId: null,
          failReason: event.data.failReason,
          configNames,
        }
      case DamNotificationName.AssetFileDuplicate:
        return {
          kind: 'duplicate',
          assetId: event.data.asset,
          fileId: null,
          originAssetFile: event.data.originAssetFile,
          assetType: event.data.assetType,
          configNames,
        }
      case DamNotificationName.AssetMetadataProcessed:
        return { kind: 'metadata', assetId: event.data.asset, fileId: null, configNames }
      case DamNotificationName.AssetFileCopied:
        return { kind: 'copied', assetId: event.data.asset, fileId: null, configNames }
    }
    return null
  }

  const { addDamNotificationListener } = useDamNotifications()
  // Starts with the first row, not with the store. An application with its own queue store
  // keeps this one alive too, and both would answer every notification. Never removed.
  let listening = false
  function listenToNotifications() {
    if (listening) return
    listening = true
    // Listens on every socket of the page. An event concerns only the queues of its socket's configurations.
    const listen = () =>
      addDamNotificationListener(
        (event, origin) => {
          const settlementEvent = toSettlementEvent(event, origin)
          // Not awaited: the read it triggers happens later.
          if (settlementEvent) void settlement.notify(settlementEvent)
        },
        { all: true }
      )
    // Run in the store's scope. The first row is added from a component,
    // and a listener in that component's scope would be disposed with it.
    if (storeScope) storeScope.run(listen)
    else listen()
  }

  async function addByCopyToLicence(
    queueKey: UploadQueueKey,
    extSystem: IntegerId,
    assetLicence: IntegerId,
    assets: DocId[],
    configName: string
  ) {
    // Throws here for an unknown configuration, before anything is done, so its DAM config store is not created.
    useCommonAdminCoreDamOptions(configName)
    const { getDamConfigExtSystem } = useDamConfigState(undefined, configName)

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByCopyToLicence: Ext system must be initialised.')
    }
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
      // Nothing is uploaded for a copy. It waits for the server from the start.
      const added = core.getQueueItems(queueKey).at(-1)
      if (added) core.track(queueKey, added)
    }
  }

  async function addByFiles(
    queueKey: UploadQueueKey,
    extSystem: IntegerId,
    assetLicence: IntegerId,
    files: File[],
    configName: string
  ) {
    // Throws here for an unknown configuration, before anything is done, so its DAM config store is not created.
    useCommonAdminCoreDamOptions(configName)
    const { getDamConfigExtSystem } = useDamConfigState(undefined, configName)

    const configExtSystem = getDamConfigExtSystem(extSystem)
    if (isUndefined(configExtSystem)) {
      throw new Error('useUploadQueuesStore.addByFiles: Ext system must be initialised.')
    }
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

  // Legacy names kept for callers until the queues are unified. `of`:
  // whose rows they settle, read with that configuration's client.

  const targetOf = (assetId: DocId, of: UploadQueueRowsOf) => ({
    assetId,
    fileId: null,
    configNames: [isString(of) ? of : configOf(of.queueKey)],
  })

  function queueItemProcessed(assetId: DocId, of: UploadQueueRowsOf) {
    return settlement.notify({ kind: 'processed', ...targetOf(assetId, of) })
  }

  function queueItemFullyProcessed(assetId: DocId, of: UploadQueueRowsOf) {
    return settlement.settleKnownProcessed(targetOf(assetId, of), { withMetadata: true })
  }

  function queueItemDuplicate(
    assetId: DocId,
    originAssetFile: DocIdNullable,
    assetType: DamAssetTypeType | null,
    of: UploadQueueRowsOf
  ) {
    return settlement.settleKnownDuplicate(targetOf(assetId, of), originAssetFile, assetType)
  }

  async function queueItemFailed(assetId: DocId, failReason: AssetFileFailReasonType, of: UploadQueueRowsOf) {
    settlement.settleKnownFailed(targetOf(assetId, of), failReason)
  }

  /**
   * Row refresh button: reads the file's current state and settles the asset's rows by it.
   */
  function refreshAsset(assetId: DocId, of: UploadQueueRowsOf): Promise<UploadRefreshOutcome> {
    return settlement.refreshAsset(targetOf(assetId, of))
  }

  async function stopItemUpload(queueKey: UploadQueueKey, queueItem: UploadQueueItem, _index?: number) {
    core.stopItemUpload(queueKey, queueItem)
  }

  // Pending detail-save writes per configuration and asset. Only the latest one writes.
  // Otherwise overlapping saves left rows with whichever read
  // answered last, and the later save kept the earlier values.
  // Two DAMs may share an asset id, so saves under two configurations concern two assets.
  const detailWrites = new Map<string, number>()
  const detailWriteKey = (configName: string, assetId: DocId) => `${configName}\u0000${assetId}`
  // Write numbers come from one global counter and are never reused.
  // A per-asset counter let a third save reuse the first save's
  // number, and the first save's late read wrote over the third.
  let lastDetailWrite = 0

  // Notes of pending detail saves. A write updates the other notes.
  const openNotes = new Set<RowsNote>()

  /**
   * Snapshots the rows of `assetId` in every queue of `configName`, field by field, when a detail save is pressed.
   * Pass it to `updateFromDetail` on success or to `forgetRowsNote` on failure.
   */
  function noteRowsOfAsset(assetId: DocId, configName: string): RowsNote {
    const rows = new Map<UploadQueueItem, EditableFields>()
    queues.value.forEach((queue, queueKey) => {
      if (configOf(queueKey) !== configName) return
      queue.items.forEach((item) => {
        if (item.assetId === assetId && item.type) rows.set(item, editableFieldsOf(item))
      })
    })
    const note = { assetId, configName, rows }
    openNotes.add(note)
    return note
  }

  /**
   * The save for this note failed. Nothing is written from it.
   */
  function forgetRowsNote(note: RowsNote) {
    openNotes.delete(note)
  }

  /**
   * `kept`: what the write into `item` left as the user had it.
   * Every other note of that asset and configuration takes the rest.
   */
  const othersTakeWrite = (own: RowsNote, item: UploadQueueItem, kept: KeptByWrite) => {
    openNotes.forEach((note) => {
      if (note === own || note.assetId !== own.assetId) return
      if (note.configName === own.configName) takeWrite(note, item, kept)
    })
  }

  /**
   * `configName`: the DAM configuration the detail was saved under.
   * Only its queues are written, and names go to its caches.
   * `mainFileSingleUse`: the switch saved with the detail. `rowsAtSave`: the
   * rows when save was pressed (`noteRowsOfAsset`); current rows if omitted.
   * A field the user changed since keeps the user's value, custom data
   * keys each on their own. Unchanged fields take the saved values.
   * Of two concurrent writes of one asset under one configuration, only the later one writes.
   */
  async function updateFromDetail(
    asset: AssetDetailItemDto,
    configName: string,
    mainFileSingleUse?: boolean | null,
    rowsAtSave?: RowsNote
  ) {
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    let dam: ReturnType<typeof useCommonAdminCoreDamOptions>
    try {
      dam = useCommonAdminCoreDamOptions(configName)
    } catch (e) {
      // Unknown configuration name: rows are left alone silently.
      return
    }
    const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords(configName)
    const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors(configName)
    // Only this configuration's queues: another DAM may have an asset with the same id.
    const queuesOfConfig = () =>
      Array.from(queues.value.entries()).filter(([queueKey]) => configOf(queueKey) === configName)
    // A detail opened from a row keeps notifying the queue even when no queue has a row of the
    // asset. Then there is nothing to write, and the save would wait for the read in vain.
    const rows = queuesOfConfig().flatMap(([, queue]) => queue.items)
    const isRowOfAsset = (item: UploadQueueItem) => item.assetId === asset.id && !!item.type
    // A processing row may become a row of the asset during the read,
    // when its file turns out to be a duplicate of the asset's file.
    // It gets the write like any row of the asset, since the asset was not read while no row had it.
    // The DAM detects duplicates only within the file's licence, so rows of another licence are excluded.
    const mayBecomeRowOfAsset = (item: UploadQueueItem) =>
      !!item.type && item.status === UploadQueueItemStatus.Processing && item.licenceId === asset.licence
    if (!rows.some(isRowOfAsset) && !rows.some(mayBecomeRowOfAsset)) {
      if (rowsAtSave) forgetRowsNote(rowsAtSave)
      return
    }
    const note = rowsAtSave ?? noteRowsOfAsset(asset.id, configName)
    const before = note.rows
    const turn = ++lastDetailWrite
    const writeKey = detailWriteKey(configName, asset.id)
    detailWrites.set(writeKey, turn)
    // A later save of this asset under this configuration started its write since. That one writes.
    const isLatest = () => detailWrites.get(writeKey) === turn
    try {
      const assetRes = await fetchAsset(dam.damClient, dam.endPointAsset, asset.id)
      if (!isLatest()) return
      // One answer serves the asset's rows in every queue of the configuration, but each row gets its own copies.
      // Filling a custom field writes into custom data in place, so a shared
      // object would change another queue's row and that queue would send it.
      queuesOfConfig().forEach(([queueKey, queue]) => {
        queue.items.forEach((item) => {
          if (item.assetId === assetRes.id && item.type) {
            // The detail saves the switch too. Left unchanged, the next queue save would send the old value.
            const kept = writeUnchanged(item, before.get(item), {
              keywords: assetRes.keywords,
              authors: assetRes.authors,
              customData: assetRes.metadata.customData,
              mainFileSingleUse: assetRes.mainFileSingleUse,
            })
            othersTakeWrite(note, item, kept)
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
      if (!isLatest()) return
      // The detail is saved anyway. Unchanged rows would send their
      // old values with the next queue save, over the detail's values.
      // Each row gets its own copies, not the detail's lists.
      // Suggestions come from the server and stay as the rows have them.
      queuesOfConfig().forEach(([, queue]) => {
        queue.items.forEach((item) => {
          if (item.assetId === asset.id && item.type) {
            const kept = writeUnchanged(item, before.get(item), {
              keywords: asset.keywords,
              authors: asset.authors,
              customData: asset.metadata.customData,
              mainFileSingleUse: isUndefined(mainFileSingleUse) ? undefined : mainFileSingleUse,
            })
            othersTakeWrite(note, item, kept)
            addToCachedKeywords(item.keywords)
            addToCachedAuthors(item.authors)
          }
        })
      })
      fetchCachedAuthors()
      fetchCachedKeywords()
    } finally {
      forgetRowsNote(note)
      if (isLatest()) detailWrites.delete(writeKey)
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
     * Whether a refresh may still change a failed row. True when its finish request went out before the client gave
     * up and the server has said nothing final since, or when it is a duplicate whose original could not be read.
     */
    refreshMayHelp: core.refreshMayHelp,
    /**
     * The row failed because its asset was missing from enough reads ("Asset už neexistuje.").
     */
    isGivenUpMissing: (item: UploadQueueItem) => settlement.isGivenUpMissing(item),
    removeByIndex: core.removeByIndex,
    stopItemUpload,
    getQueueTotalCount: core.getQueueTotalCount,
    getQueueProcessedCount: core.getQueueProcessedCount,
    stopUpload: core.stopUpload,
    getQueueItemsTypes: core.getQueueItemsTypes,
    updateFromDetail,
    noteRowsOfAsset,
    forgetRowsNote,
    forceReloadFileInput: core.forceReloadFileInput,
  }
})
