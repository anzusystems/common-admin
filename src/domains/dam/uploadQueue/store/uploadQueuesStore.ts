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

/** The fields of a row the user edits, and the save of a detail writes. */
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

/** The rows of an asset as they were at a moment, field by field (`noteRowsOfAsset`). */
export interface RowsNote {
  assetId: DocId
  /** The DAM configuration of the queues the rows are in. */
  configName: string
  rows: Map<UploadQueueItem, EditableFields>
}

/**
 * The rows a settle function of the store is for: those of the queues of the DAM configuration of this name, or of
 * the configuration of the queue `queueKey`. Required: two DAMs may give one asset id.
 */
export type UploadQueueRowsOf = string | { queueKey: UploadQueueKey }

/** What a write left as the user had changed it: those fields, and those keys of the custom data. */
interface KeptByWrite {
  fields: Set<'keywords' | 'authors' | 'mainFileSingleUse'>
  customKeys: Set<string>
}

/**
 * What the detail saved, into a row of its asset, each copy the row's own: a field the user has changed since `was`
 * (the row as the save was pressed) keeps what the user gave it, a field of the custom data each on its own. A row
 * `was` does not know (it became a row of the asset meanwhile) takes all. `mainFileSingleUse` undefined: left as is.
 * Answers what it kept.
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
 * Another note of the rows, of a save of the same asset still on its way, takes what a write has just put into `item`:
 * that is no change of the user's, and the later write takes its place. Taken as the user's, the later save kept the
 * values of the earlier one.
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

  // The list goes to the client as it is, and reports nothing by itself. A failure it reports is thrown as it was
  // reported: the settlement asks it whether it was written down.
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
        throw report(mapApiError(error, context), context)
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
      failureReported: apiErrorIsReported,
    },
    // Two DAMs may give one asset id: what concerns the rows of a configuration is settled in its queues alone.
    configOf,
    // The names of the rows of a queue are of the DAM of its configuration.
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
    // The socket of the configuration of the queue: a configuration without one is polled for densely.
    connection: {
      isPushAlive: (queueKey) => useDamNotificationsConnection(configOf(queueKey)).isPushAlive(),
      onChange: useDamNotificationsConnection().onChange,
    },
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
  // `configNames`: the configurations of the socket it came through, whose queues alone it concerns.
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
  // With its first row, not with the store: an application with a queue store of its own keeps this one alive
  // too, and both would answer every notification. Never taken back.
  let listening = false
  function listenToNotifications() {
    if (listening) return
    listening = true
    // Every socket of the page: an event concerns the rows of the queues of the configurations of its socket.
    const listen = () =>
      addDamNotificationListener(
        (event, origin) => {
          const settlementEvent = toSettlementEvent(event, origin)
          // Not awaited: the read it asks for comes later.
          if (settlementEvent) void settlement.notify(settlementEvent)
        },
        { all: true }
      )
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
    configName: string
  ) {
    // Thrown here for a configuration the application has not got, before anything is done for it: its DAM
    // configuration store is not made either.
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
    configName: string
  ) {
    // Thrown here for a configuration the application has not got, before anything is done for it: its DAM
    // configuration store is not made either.
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

  // The names of before the settlement, kept for their callers until the queues are unified. `of`: whose rows they
  // settle, read by the client of that configuration.

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

  /** The refresh button of a row: asks what became of the file now, and settles the rows of the asset by it. */
  function refreshAsset(assetId: DocId, of: UploadQueueRowsOf): Promise<UploadRefreshOutcome> {
    return settlement.refreshAsset(targetOf(assetId, of))
  }

  async function stopItemUpload(queueKey: UploadQueueKey, queueItem: UploadQueueItem, _index?: number) {
    core.stopItemUpload(queueKey, queueItem)
  }

  // The writes of saves of a detail of an asset on their way, counted by the configuration and the asset: only the
  // latest one writes. Two that overlapped left the rows with the values of whichever read answered last, and the
  // later save, with the notes of its own, kept the values of the earlier one as typed meanwhile. Two DAMs may give one
  // asset id: the saves under two configurations are of two assets.
  const detailWrites = new Map<string, number>()
  const detailWriteKey = (configName: string, assetId: DocId) => `${configName}\u0000${assetId}`
  // The numbers of those writes, one count for every asset: a number is never given twice, also once the write of an
  // asset that had it is over. Counted by the asset, the third save after two that had ended took the number of the
  // first, and the late read of the first wrote while the third was on its way.
  let lastDetailWrite = 0

  // The notes of the rows of saves of a detail that are on their way: a write takes its place in the others.
  const openNotes = new Set<RowsNote>()

  /**
   * The rows of the asset `assetId` as they are, in every queue of the DAM configuration `configName`, field by field:
   * taken as the save of a detail of that asset is pressed, and handed to `updateFromDetail` once it has been
   * answered, or to `forgetRowsNote` once it has failed.
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

  /** The save the note was taken for has failed: nothing writes by it. */
  function forgetRowsNote(note: RowsNote) {
    openNotes.delete(note)
  }

  /**
   * `kept`: what the write into `item` left as the user had it; every other note of that asset, of that configuration,
   * takes the rest.
   */
  const othersTakeWrite = (own: RowsNote, item: UploadQueueItem, kept: KeptByWrite) => {
    openNotes.forEach((note) => {
      if (note === own || note.assetId !== own.assetId) return
      if (note.configName === own.configName) takeWrite(note, item, kept)
    })
  }

  /**
   * `configName`: the DAM configuration the detail was saved under; only the rows of the
   * queues of that configuration are written, and their names go to its caches. `mainFileSingleUse`: the switch the
   * detail saved with the asset, which keeps it apart from the asset it hands over. `rowsAtSave`: the rows of the asset
   * as the save was pressed (`noteRowsOfAsset`); as they are now where not given. A field of a row the user has changed
   * since keeps what the user gave it (a field of the custom data each on its own): only the fields as they were then
   * take what the detail saved. What was typed into the row meanwhile was replaced. Of two writes of one asset under
   * one configuration on their way at once, only the later one writes.
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
      // The application has no configuration of that name: the rows are left alone, in silence, as ever.
      return
    }
    const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords(configName)
    const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors(configName)
    // The queues of the configuration: another DAM may have an asset of that id.
    const queuesOfConfig = () =>
      Array.from(queues.value.entries()).filter(([queueKey]) => configOf(queueKey) === configName)
    // The detail goes on telling the queue once it was opened from a row, also of an asset no queue holds a row of:
    // there is nothing to write then, and its save would wait for the read in vain.
    const rows = queuesOfConfig().flatMap(([, queue]) => queue.items)
    const isRowOfAsset = (item: UploadQueueItem) => item.assetId === asset.id && !!item.type
    // A row whose file the server is processing may become a row of the asset while it is read: one whose file turns
    // out to be a duplicate of the file of the asset becomes the original of that duplicate. It gets the write as any
    // row of the asset: the asset was not read at all while no row had it yet. The DAM finds a duplicate within the
    // licence of the file only: a row of another licence never becomes a row of the asset.
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
    // A later save of the detail of the asset under the configuration has begun its write since: that one writes.
    const isLatest = () => detailWrites.get(writeKey) === turn
    try {
      const assetRes = await fetchAsset(dam.damClient, dam.endPointAsset, asset.id)
      if (!isLatest()) return
      // One answer for the rows of the asset in every queue of the configuration: each gets copies of its own, or a fill
      // of a custom field in one queue (it writes into the custom data in place) would change the row of another, and
      // that queue would send it with its next save.
      queuesOfConfig().forEach(([queueKey, queue]) => {
        queue.items.forEach((item) => {
          if (item.assetId === assetRes.id && item.type) {
            // The detail saves the switch too: left as it was, the next save of the queue would send the old value.
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
      // The detail is saved all the same: left as they were, the rows would send their old values with the next save
      // of the queue, over what the detail has just saved. Each row gets copies of its own, not the lists of the
      // detail. The suggestions are the server's to say, and stay as the rows have them.
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
     * Whether a refresh may still change a failed row: its finish request went out before the client gave it up and
     * the server has said nothing final about it since, or its file is a duplicate whose original could not be
     * read. A row that failed otherwise has no use for refresh.
     */
    refreshMayHelp: core.refreshMayHelp,
    /** The row failed because its asset was missing from as many reads as it takes ("Asset už neexistuje."). */
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
