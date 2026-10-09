import { toRaw } from 'vue'
import type { DocIdNullable } from '@/shared/types/common'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  type AssetFile,
  AssetFileFailReasonDefault,
  type AssetFileFailReasonType,
  type AssetFileNullable,
  AssetFileProcessStatus,
  type AssetFileProcessStatusType,
} from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { useAssetSuggestions } from '@/domains/dam/uploadQueue/composables/assetSuggestions'
import {
  UploadRowRole,
  type UploadRowRoleType,
  type UploadSettlementProfile,
  type UploadSettlementTarget,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { isArray, isNull, isObject, isUndefined } from '@/shared/utils/common'

export interface UploadTrackState {
  queueKey: UploadQueueKey
  /** When the row began to wait for the server, in the time of the scheduler. */
  eligibleSince: number
  /** The client gave the row up on its finish request; the server may have finished the file all the same. */
  clientFailed: boolean
  /** Successful reads in a row that did not carry the asset of the row, or its file among the slots. */
  misses: number
  /** Failed reads in a row. */
  readFailures: number
  /**
   * A failed read of the row, or one that found no asset, was let be reported, and no read has brought its asset
   * since: the next ones are not.
   */
  reported: boolean
}

export interface UploadRowNotice {
  /** The row has waited longer than a processing should take. */
  slow: boolean
  /** The reads of the row keep failing. */
  readWarning: boolean
  /** Which of the two the settlement has written into `row.error`. */
  shown: 'slow' | 'readWarning' | null
  /** The text it wrote then. A row whose message is another one by now carries somebody else's error. */
  text: string | null
}

/** What a read is to do for one target. */
export interface UploadReadIntent {
  /** The state an event carried: it stands when the read itself shows no final state. */
  hint: 'processed' | null
  /** When the row settles as processed, load its metadata as well. */
  metadata: boolean
  /** The metadata notification: the metadata may come before the final state. */
  early: boolean
  /** A read that tells a row with `settleOn: 'never'` its file is processed. */
  seen: boolean
}

/** What the settlement remembers about rows. Every key is `toRaw(row)`. */
export interface UploadSettleMemory {
  tracked: WeakMap<UploadQueueItem, UploadTrackState>
  /** The last write an event made into the row; a read that started before it is stale. Never cleared. */
  revision: WeakMap<UploadQueueItem, number>
  metadataLoaded: WeakSet<UploadQueueItem>
  /** Failed rows an event has brought back: their next read loads the metadata. */
  reviveWithMetadata: WeakSet<UploadQueueItem>
  /** Failed rows a refresh may still change: given up by the client and asked about, or left without their original. */
  refreshMayHelp: WeakSet<UploadQueueItem>
  notices: WeakMap<UploadQueueItem, UploadRowNotice>
  /** One counter for the revisions and the starts of the reads. */
  clock: number
}

export const createUploadSettleMemory = (): UploadSettleMemory => ({
  tracked: new WeakMap(),
  revision: new WeakMap(),
  metadataLoaded: new WeakSet(),
  reviveWithMetadata: new WeakSet(),
  refreshMayHelp: new WeakSet(),
  notices: new WeakMap(),
  clock: 0,
})

export interface UploadSettleRow {
  queueKey: UploadQueueKey
  queue: UploadQueue
  row: UploadQueueItem
}

export interface UploadSettleOptions {
  /** A row stopped being tracked, by a write or by the store. */
  onUntrack?(queueKey: UploadQueueKey): void
  /** The settlement was disposed of: what a read of an original brings after that is written nowhere. */
  isDisposed?(): boolean
}

export const isFinalFileStatus = (
  status: AssetFileProcessStatusType | null | undefined
): status is 'processed' | 'duplicate' | 'failed' =>
  status === AssetFileProcessStatus.Processed ||
  status === AssetFileProcessStatus.Duplicate ||
  status === AssetFileProcessStatus.Failed

/**
 * The state a read gives the file of the target. An asset carries the state of its main file alone: a final state
 * it shows stands, otherwise the state the event carried, when it carried one. Of another file (a slot beside the
 * main one) the asset says nothing, and only what the event carried stands.
 */
export const resolveReadStatus = (
  asset: AssetDetailItemDto,
  target: Pick<UploadSettlementTarget, 'fileId'>,
  intent: Pick<UploadReadIntent, 'hint'>
): AssetFileProcessStatusType | undefined => {
  if (!isNull(target.fileId) && target.fileId !== asset.mainFile?.id) return intent.hint ?? undefined
  const readStatus = asset.mainFile?.fileAttributes?.status
  return isFinalFileStatus(readStatus) ? readStatus : (intent.hint ?? readStatus)
}

export const clearRowError = (row: UploadQueueItem) => {
  row.error = { hasError: false, message: '', assetFileFailReason: AssetFileFailReasonDefault }
}

// Empty as the mass operations of the queue understand it.
export const isEmptyMetadataValue = (value: unknown) =>
  isUndefined(value) || isNull(value) || value === '' || (isArray(value) && !value.length)

/**
 * The first load of the metadata of a row. What the user has put into the row before it (a mass operation of the
 * queue) stays: only the empty lists and the empty custom fields are filled.
 */
export function mergeLoadedMetadata(
  queue: UploadQueue,
  row: UploadQueueItem,
  asset: AssetDetailItemDto,
  caches: Pick<UploadSettlementProfile['caches'], 'addAuthors' | 'addKeywords'>
) {
  const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
  if (isEmptyMetadataValue(row.keywords)) row.keywords = [...(asset.keywords ?? [])]
  if (isEmptyMetadataValue(row.authors)) row.authors = [...(asset.authors ?? [])]
  const customData: Record<string, unknown> = isObject(asset.metadata.customData)
    ? { ...asset.metadata.customData }
    : {}
  if (isObject(row.customData)) {
    for (const [key, value] of Object.entries(row.customData)) {
      if (!isEmptyMetadataValue(value)) customData[key] = value
    }
  }
  row.customData = customData
  // Not fields of a mass operation: the server's.
  row.mainFileSingleUse = asset.mainFileSingleUse
  row.mainFileInternal = asset.mainFileInternal
  const authorSuggestions = asset.metadata.authorSuggestions ?? {}
  updateNewNames(authorSuggestions, queue.suggestions.newAuthorNames)
  updateNewNames(asset.metadata.keywordSuggestions ?? {}, queue.suggestions.newKeywordNames)
  row.authorConflicts = getAuthorConflicts(authorSuggestions)
  caches.addKeywords(row.keywords)
  caches.addAuthors(row.authors)
  caches.addAuthors(row.authorConflicts)
}

/**
 * What a read asset gives a row without a change of its state. `hadMetadata`: the metadata of the row was loaded
 * once, whether or not it has its form now.
 */
export function decorateRow(
  row: UploadQueueItem,
  asset: AssetDetailItemDto,
  mainFile: AssetFile,
  role: UploadRowRoleType,
  hadMetadata: boolean
) {
  row.assetStatus = asset.attributes.assetStatus
  // Only when the row is the main file: a slot would take a preview describing another.
  if (!isNull(row.fileId) && row.fileId !== mainFile.id) return
  if (mainFile.links?.image_detail) row.imagePreview = mainFile.links.image_detail
  // Not on a mass-edit row, nor on one that has or had its metadata: there the switches are form fields the user
  // may have set, also on a row a failure took the form of and which gets it back.
  if (!row.canEditMetadata && !hadMetadata && role !== UploadRowRole.MassEdit) {
    row.mainFileSingleUse = asset.mainFileSingleUse
    row.mainFileInternal = asset.mainFileInternal
  }
}

/**
 * The writes of the settlement: a read asset or a known state into the rows of the queues. No timers and no reads
 * of its own, but for the original of a duplicate.
 */
export function createUploadSettle(
  profile: UploadSettlementProfile,
  memory: UploadSettleMemory = createUploadSettleMemory(),
  options: UploadSettleOptions = {}
) {
  const policyOf = (row: UploadQueueItem) => profile.policyFor(profile.roleOf(row))

  /** The rows of all the queues, as they are now. */
  const rows = (): UploadSettleRow[] => {
    const all: UploadSettleRow[] = []
    for (const [queueKey, queue] of profile.queues()) {
      for (const row of queue.items) all.push({ queueKey, queue, row })
    }
    return all
  }

  // A stopped row is written by nothing. Asked anew after every wait: the row may be stopped meanwhile.
  const isStopped = (row: UploadQueueItem) => row.status === UploadQueueItemStatus.Stop

  const isLive = (row: UploadQueueItem) => {
    const raw = toRaw(row)
    for (const [, queue] of profile.queues()) {
      if (toRaw(queue.items).some((item) => toRaw(item) === raw)) return true
    }
    return false
  }

  // A row marked as a duplicate is settled and read-only. A row that became its original is an editable row like
  // any other, and is not barred from anything.
  const isMarkedDuplicate = (row: UploadQueueItem) => row.isDuplicate && policyOf(row).duplicate === 'markDuplicate'
  const isDisposed = () => options.isDisposed?.() === true

  const decorate = (row: UploadQueueItem, asset: AssetDetailItemDto, mainFile: AssetFile) =>
    decorateRow(row, asset, mainFile, profile.roleOf(row), memory.metadataLoaded.has(toRaw(row)))

  const revisionOf = (row: UploadQueueItem) => memory.revision.get(toRaw(row)) ?? 0
  /** An event has written into the row: a read that started before this is stale for it. */
  const bump = (row: UploadQueueItem) => {
    const mark = ++memory.clock
    memory.revision.set(toRaw(row), mark)
    return mark
  }
  const isStale = (row: UploadQueueItem, startedAt: number) => startedAt <= revisionOf(row)
  /** The mark of a read that starts now. */
  const startRead = () => ++memory.clock

  const trackStateOf = (row: UploadQueueItem) => memory.tracked.get(toRaw(row))
  const untrack = (row: UploadQueueItem) => {
    const raw = toRaw(row)
    const state = memory.tracked.get(raw)
    if (!state) return
    memory.tracked.delete(raw)
    options.onUntrack?.(state.queueKey)
  }

  /** Whether a refresh may still change a failed row; the store is told when that changes. */
  const setRefreshMayHelp = (queueKey: UploadQueueKey, row: UploadQueueItem, mayHelp: boolean) => {
    const raw = toRaw(row)
    if (memory.refreshMayHelp.has(raw) === mayHelp) return
    if (mayHelp) memory.refreshMayHelp.add(raw)
    else memory.refreshMayHelp.delete(raw)
    profile.hooks.onRefreshMayHelp?.(queueKey, row, mayHelp)
  }

  const noticeOf = (row: UploadQueueItem) => {
    const raw = toRaw(row)
    let notice = memory.notices.get(raw)
    if (!notice) {
      notice = { slow: false, readWarning: false, shown: null, text: null }
      memory.notices.set(raw, notice)
    }
    return notice
  }
  const dropNotice = (row: UploadQueueItem) => memory.notices.delete(toRaw(row))
  // Whether the message of the row is still the text the settlement wrote into it. The store writes into
  // `row.error` as well (an upload that failed), and that error is not the settlement's to take away.
  const showsOwnText = (row: UploadQueueItem) => {
    const notice = memory.notices.get(toRaw(row))
    return !!notice?.shown && row.error.message === notice.text
  }

  /**
   * Writes into `row.error` the one of the two texts of the settlement that holds, or takes its own text away:
   * only its own, and only while it is still what the row says.
   * `clear` takes away an error the settlement did not write as well: the row has settled as processed.
   */
  const syncNotice = (row: UploadQueueItem, { clear = false }: { clear?: boolean } = {}) => {
    const notice = noticeOf(row)
    let wants: UploadRowNotice['shown'] = null
    if (
      notice.readWarning &&
      policyOf(row).metadata === 'load' &&
      !row.canEditMetadata &&
      !isMarkedDuplicate(row) &&
      row.status !== UploadQueueItemStatus.Failed
    ) {
      wants = 'readWarning'
    } else if (notice.slow && row.status === UploadQueueItemStatus.Processing) {
      wants = 'slow'
    }
    if (wants) {
      const text = wants === 'slow' ? profile.messages.processingTooLong(row) : profile.messages.readFailed(row)
      row.error.hasError = true
      row.error.message = text
      notice.shown = wants
      notice.text = text
      return
    }
    if (clear) {
      clearRowError(row)
    } else if (showsOwnText(row)) {
      // The text goes. The flag goes with it, unless the row has failed since: then the flag is the failure's.
      if (row.status === UploadQueueItemStatus.Failed) row.error = { ...row.error, message: '' }
      else clearRowError(row)
    }
    notice.shown = null
    notice.text = null
  }

  const loadMetadata = (queue: UploadQueue, row: UploadQueueItem, asset: AssetDetailItemDto) => {
    mergeLoadedMetadata(queue, row, asset, profile.caches)
    memory.metadataLoaded.add(toRaw(row))
  }

  const settleProcessed = (
    { queueKey, queue, row }: UploadSettleRow,
    asset: AssetDetailItemDto,
    mainFile: AssetFile,
    intent: UploadReadIntent
  ) => {
    const raw = toRaw(row)
    // The client marks an upload failed when one of its requests fails, and the server may have finished it all the
    // same. Such a row lost its form with the failure, and gets it back here, with its metadata.
    const wasFailed = row.status === UploadQueueItemStatus.Failed || memory.reviveWithMetadata.has(raw)
    row.status = UploadQueueItemStatus.Uploaded
    // A copy to the licence knows only its asset, and the image is built from the file id.
    if (isNull(row.fileId)) row.fileId = mainFile.id
    decorate(row, asset, mainFile)
    const notice = noticeOf(row)
    if (policyOf(row).metadata === 'load' && !isMarkedDuplicate(row) && (intent.metadata || wasFailed)) {
      // Loaded once, and never into a row whose form is on: it keeps what the user has typed since.
      if (!row.canEditMetadata && !memory.metadataLoaded.has(raw)) loadMetadata(queue, row, asset)
      row.canEditMetadata = true
      notice.readWarning = false
      profile.hooks.afterMetadataLoaded?.(queueKey, row)
    }
    memory.reviveWithMetadata.delete(raw)
    notice.slow = false
    syncNotice(row, { clear: true })
    setRefreshMayHelp(queueKey, row, false)
    untrack(row)
    profile.hooks.onRowFinal(queueKey, row)
  }

  const settleFailed = (
    { queueKey, row }: Pick<UploadSettleRow, 'queueKey' | 'row'>,
    failReason: AssetFileFailReasonType
  ) => {
    row.status = UploadQueueItemStatus.Failed
    // Without the old text: the row prints a message over the reason, and the old one is not why.
    row.error = { hasError: true, message: '', assetFileFailReason: failReason }
    row.canEditMetadata = false
    dropNotice(row)
    memory.reviveWithMetadata.delete(toRaw(row))
    setRefreshMayHelp(queueKey, row, false)
    untrack(row)
    profile.hooks.onRowFinal(queueKey, row)
  }

  /** A failure the caller knows of, without a read. */
  const settleKnownFailed = (target: UploadSettlementTarget, failReason: AssetFileFailReasonType) => {
    for (const entry of rows()) {
      if (entry.row.status === UploadQueueItemStatus.Stop || !profile.matches(entry.row, target, 'settle')) continue
      settleFailed(entry, failReason)
      bump(entry.row)
    }
  }

  /**
   * The state of a `processed` event, written at once into the rows that settle on the event. Also what a tick
   * does for a slot row whose file the list of slots shows processed.
   */
  const settleProcessedByEvent = (target: UploadSettlementTarget) => {
    for (const { queueKey, row } of rows()) {
      if (row.status === UploadQueueItemStatus.Stop || policyOf(row).settleOn !== 'event') continue
      if (!profile.matches(row, target, 'settle')) continue
      const raw = toRaw(row)
      if (row.status === UploadQueueItemStatus.Failed) memory.reviveWithMetadata.add(raw)
      row.status = UploadQueueItemStatus.Uploaded
      // A row the client gave up on, which had its metadata by then, gets the form back as the user left it.
      if (!isMarkedDuplicate(row) && memory.metadataLoaded.has(raw)) row.canEditMetadata = true
      noticeOf(row).slow = false
      syncNotice(row, { clear: true })
      bump(row)
      setRefreshMayHelp(queueKey, row, false)
      untrack(row)
      profile.hooks.onRowFinal(queueKey, row)
    }
  }

  /** A `processed` event for the rows whose state it does not change. */
  const announceProcessed = (target: UploadSettlementTarget) => {
    for (const { queueKey, row } of rows()) {
      if (row.status === UploadQueueItemStatus.Stop || policyOf(row).settleOn !== 'never') continue
      if (profile.matches(row, target, 'decorate')) profile.hooks.onProcessedSeen?.(queueKey, row)
    }
  }

  const duplicateRows = (
    target: UploadSettlementTarget,
    policy: 'becomeOriginal' | 'markDuplicate',
    eligible: (row: UploadQueueItem) => boolean
  ) =>
    rows().filter(
      ({ row }) =>
        row.status !== UploadQueueItemStatus.Stop &&
        eligible(row) &&
        policyOf(row).duplicate === policy &&
        profile.matches(row, target, 'settle')
    )

  // The row stays, marked: settled first, completed from the original file afterwards, so the wait for that file
  // does not hold an upload slot.
  const markDuplicates = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null,
    eligible: (row: UploadQueueItem) => boolean
  ) => {
    const marked: Array<{ row: UploadQueueItem; mark: number }> = []
    for (const { queueKey, row } of duplicateRows(target, 'markDuplicate', eligible)) {
      row.isDuplicate = true
      row.status = UploadQueueItemStatus.Uploaded
      row.canEditMetadata = false
      clearRowError(row)
      dropNotice(row)
      memory.reviveWithMetadata.delete(toRaw(row))
      marked.push({ row, mark: bump(row) })
      setRefreshMayHelp(queueKey, row, false)
      untrack(row)
      profile.hooks.onRowFinal(queueKey, row)
    }
    if (!marked.length || !originFileId || !assetType || !profile.readers.duplicateOriginFile) return
    let file: AssetFileNullable = null
    try {
      file = await profile.readers.duplicateOriginFile(originFileId, assetType)
    } catch (error) {
      console.error('uploadQueue: the duplicated file could not be read', error)
    }
    if (!file || isDisposed()) return
    for (const { row, mark } of marked) {
      // Only a row nothing has written into meanwhile, and which is still there.
      if (!isLive(row) || row.status === UploadQueueItemStatus.Stop || !row.isDuplicate) continue
      if (revisionOf(row) !== mark) continue
      row.fileId = file.id
      row.duplicateAssetId = file.asset
      row.mainFileSingleUse = file.flags.singleUse
      if (file.links?.image_detail) row.imagePreview = file.links.image_detail
    }
  }

  // The row becomes the original: its asset and file are replaced, and it takes the metadata of the original.
  // Answers whether the original could not be read and a row is left that a refresh may still help.
  const becomeOriginals = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null,
    eligible: (row: UploadQueueItem) => boolean
  ): Promise<boolean> => {
    if (!originFileId || assetType !== DamAssetType.Image) return false
    // Noted before the original is asked for. After the wait only a row no event has written into meanwhile, which
    // is still in its queue and not stopped, is written: the caller that knows of a duplicate is outside the order
    // of the reads, and a later event must not be undone by an earlier answer.
    const candidates = duplicateRows(target, 'becomeOriginal', eligible).map((entry) => ({
      ...entry,
      mark: revisionOf(entry.row),
    }))
    if (!candidates.length) return false
    const untouched = () =>
      candidates.filter(({ row, mark }) => isLive(row) && !isStopped(row) && revisionOf(row) === mark)
    const { updateNewNames, getAuthorConflicts } = useAssetSuggestions()
    let original: AssetDetailItemDto
    try {
      if (!profile.readers.duplicateOriginAsset) throw new Error('uploadSettlement: no reader of the original asset')
      original = await profile.readers.duplicateOriginAsset(originFileId)
    } catch {
      if (isDisposed()) return false
      let leftWithout = false
      for (const { queueKey, row } of untouched()) {
        // Noted before the row is let go: one the client gave up on keeps its way back.
        const mightHelp = memory.refreshMayHelp.has(toRaw(row))
        // Whatever its state: the next tick would only try the same read again.
        untrack(row)
        // Only a row still waiting for this answer fails: a settled one must not be flipped back to failed.
        const failsHere = row.status === UploadQueueItemStatus.Processing
        if (failsHere) {
          row.status = UploadQueueItemStatus.Failed
          // Without a text the settlement had written into it: that is no longer what is wrong with the row.
          row.error = { ...row.error, hasError: true, message: showsOwnText(row) ? '' : row.error.message }
          row.canEditMetadata = false
          dropNotice(row)
          profile.hooks.onRowFinal(queueKey, row)
        }
        // Failed for a read that failed, not for its file: the refresh of the row asks for the original again.
        // Not a row that had failed before by the word of the server, which no refresh takes back.
        if (failsHere || mightHelp) {
          setRefreshMayHelp(queueKey, row, true)
          leftWithout = true
        }
      }
      return leftWithout
    }
    if (isDisposed()) return false
    for (const { queueKey, queue, row } of untouched()) {
      const authorSuggestions = original.metadata.authorSuggestions ?? {}
      row.isDuplicate = true
      row.status = UploadQueueItemStatus.Uploaded
      clearRowError(row)
      row.fileId = originFileId
      row.duplicateAssetId = original.id
      row.assetStatus = original.attributes.assetStatus
      if (original.mainFile?.links?.image_detail) row.imagePreview = original.mainFile.links.image_detail
      row.keywords = [...(original.keywords ?? [])]
      row.authors = [...(original.authors ?? [])]
      row.customData = isObject(original.metadata.customData) ? { ...original.metadata.customData } : {}
      updateNewNames(authorSuggestions, queue.suggestions.newAuthorNames)
      updateNewNames(original.metadata.keywordSuggestions ?? {}, queue.suggestions.newKeywordNames)
      row.authorConflicts = getAuthorConflicts(authorSuggestions)
      profile.caches.addKeywords(row.keywords)
      profile.caches.addAuthors(row.authors)
      profile.caches.addAuthors(row.authorConflicts)
      row.assetId = original.id
      row.mainFileSingleUse = original.mainFileSingleUse
      row.mainFileInternal = original.mainFileInternal
      memory.metadataLoaded.add(toRaw(row))
      row.canEditMetadata = true
      dropNotice(row)
      memory.reviveWithMetadata.delete(toRaw(row))
      bump(row)
      setRefreshMayHelp(queueKey, row, false)
      untrack(row)
      profile.hooks.onRowFinal(queueKey, row)
    }
    profile.caches.fetchAuthors()
    profile.caches.fetchKeywords()
    return false
  }

  /**
   * A duplicate file, for every row that passes `matches(…, 'settle')`, each by the policy of its role.
   * `eligible` leaves out the rows a read is stale for. Answers whether a row is left without the original of
   * its duplicate, which could not be read: a refresh may still help it.
   */
  const settleDuplicate = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null,
    eligible: (row: UploadQueueItem) => boolean = () => true
  ) => {
    // Both begin at once, not one after the wait of the other: what each notes of its rows is noted now.
    const [, leftWithout] = await Promise.all([
      markDuplicates(target, originFileId, assetType, eligible),
      becomeOriginals(target, originFileId, assetType, eligible),
    ])
    return leftWithout
  }

  /** A duplicate the caller knows of, without a read of its asset. Never rejects. */
  const settleKnownDuplicate = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null
  ) => {
    try {
      await settleDuplicate(target, originFileId, assetType)
    } catch (error) {
      console.error('uploadQueue: the duplicate could not be settled', error)
    }
  }

  /** The metadata notification: the metadata and the form, whatever the state of the file. */
  const tryLoadMetadata = ({ queueKey, queue, row }: UploadSettleRow, asset: AssetDetailItemDto) => {
    if (policyOf(row).metadata !== 'load' || row.canEditMetadata) return
    // A marked duplicate is settled, and has no metadata of its own to miss.
    if (isMarkedDuplicate(row)) return
    // Nor has a row whose file failed, but the one that failed for want of this very metadata.
    if (row.status === UploadQueueItemStatus.Failed && profile.metadataGate?.(queueKey, row) !== 'load') return
    if (!memory.metadataLoaded.has(toRaw(row))) loadMetadata(queue, row, asset)
    row.canEditMetadata = true
    noticeOf(row).readWarning = false
    syncNotice(row)
    profile.hooks.afterMetadataLoaded?.(queueKey, row)
  }

  /**
   * One read asset into every row it concerns. `startedAt` is the mark of the read: a row an event has written
   * into since keeps the state the event gave it. Answers as `settleDuplicate` does: whether a row is left
   * without the original of its duplicate.
   */
  const applyAssetRead = async (
    asset: AssetDetailItemDto,
    target: UploadSettlementTarget,
    intent: UploadReadIntent,
    startedAt: number
  ) => {
    const mainFile = asset.mainFile ?? null
    const status = resolveReadStatus(asset, target, intent)
    let duplicateSettled = false
    let leftWithout = false
    for (const entry of rows()) {
      const { queueKey, row } = entry
      // The read of a duplicate's original was awaited: the row may have left its queue meanwhile.
      if (duplicateSettled && !isLive(row)) continue
      if (isStopped(row)) continue

      // The state of the file and what completes the row, unless an event has written into the row since this
      // read was sent: the event knows more than this answer.
      if (!isStale(row, startedAt) && mainFile && profile.matches(row, target, 'decorate')) {
        const maySettle = profile.matches(row, target, 'settle')
        if (status === AssetFileProcessStatus.Processed) {
          if (policyOf(row).settleOn === 'never') {
            decorate(row, asset, mainFile)
            if (intent.seen) profile.hooks.onProcessedSeen?.(queueKey, row)
          } else if (maySettle) {
            settleProcessed(entry, asset, mainFile, intent)
          }
        } else if (status === AssetFileProcessStatus.Duplicate && maySettle) {
          // Once for all the rows of the target: the original is read once.
          if (!duplicateSettled) {
            duplicateSettled = true
            leftWithout = await settleDuplicate(
              target,
              mainFile.originAssetFile,
              asset.attributes.assetType,
              (candidate) => !isStale(candidate, startedAt)
            )
            if (isDisposed()) return leftWithout
            if (!isLive(row) || isStopped(row)) continue
          }
        } else if (status === AssetFileProcessStatus.Failed && maySettle) {
          settleFailed(entry, mainFile.fileAttributes.failReason)
        }
      }

      // Into such a row as well: the metadata is no state of the file. It is loaded once, whenever it comes, and a
      // row the event has failed or marked as a duplicate is refused there. Otherwise a `processed` event that
      // overtakes the read of the metadata notification would leave the row uploaded without its form for good.
      if (intent.early && profile.matches(row, target, 'metadata')) tryLoadMetadata(entry, asset)
    }
    profile.hooks.onAssetRead?.(asset)
    return leftWithout
  }

  /**
   * The asset of a tracked row was missing from as many reads as it takes: a row still processing fails, a row
   * the client gave up on is only left alone.
   */
  const giveUpOnMissing = ({ queueKey, row }: Pick<UploadSettleRow, 'queueKey' | 'row'>) => {
    // There is no asset a refresh could read.
    setRefreshMayHelp(queueKey, row, false)
    if (row.status !== UploadQueueItemStatus.Processing) {
      untrack(row)
      return
    }
    row.status = UploadQueueItemStatus.Failed
    row.error.hasError = true
    row.error.message = profile.messages.assetMissing(row)
    row.canEditMetadata = false
    dropNotice(row)
    untrack(row)
    profile.hooks.onRowFinal(queueKey, row)
  }

  return {
    memory,
    policyOf,
    rows,
    isLive,
    bump,
    isStale,
    startRead,
    trackStateOf,
    untrack,
    setRefreshMayHelp,
    noticeOf,
    syncNotice,
    applyAssetRead,
    settleProcessedByEvent,
    announceProcessed,
    settleFailed,
    settleKnownFailed,
    settleDuplicate,
    settleKnownDuplicate,
    giveUpOnMissing,
  }
}

export type UploadSettle = ReturnType<typeof createUploadSettle>
