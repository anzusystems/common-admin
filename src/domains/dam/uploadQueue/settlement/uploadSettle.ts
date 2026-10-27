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
  /**
   * When the row started waiting for the server, in scheduler time.
   */
  eligibleSince: number
  /**
   * The client failed the row on its finish request. The server may still have finished the file.
   */
  clientFailed: boolean
  /**
   * Consecutive successful reads that did not include the row's asset, or its file among the slots.
   */
  misses: number
  readFailures: number
  /**
   * A failed read or a missing asset was already reported, and no read has found the asset since.
   * Further failures are not reported.
   */
  reported: boolean
}

export interface UploadRowNotice {
  /**
   * The row has waited longer than processing should take.
   */
  slow: boolean
  readWarning: boolean
  /**
   * Which of the two notices the settlement wrote into `row.error`.
   */
  shown: 'slow' | 'readWarning' | null
  /**
   * The text written then. If the row's message differs now, the error belongs to someone else.
   */
  text: string | null
}

/**
 * What a read should do for one target.
 */
export interface UploadReadIntent {
  /**
   * State carried by the event. It applies when the read shows no final state.
   */
  hint: 'processed' | null
  /**
   * When the row settles as processed, load its metadata as well.
   */
  metadata: boolean
  /**
   * Set by the metadata notification. Metadata may arrive before the final state.
   */
  early: boolean
  /**
   * The read tells a row with `settleOn: 'never'` that its file is processed.
   */
  seen: boolean
}

/**
 * What the settlement remembers about rows. Every key is `toRaw(row)`.
 */
export interface UploadSettleMemory {
  tracked: WeakMap<UploadQueueItem, UploadTrackState>
  /**
   * The last write an event made into the row. A read started before it is stale. Never cleared.
   */
  revision: WeakMap<UploadQueueItem, number>
  metadataLoaded: WeakSet<UploadQueueItem>
  /**
   * Failed rows revived by an event. Their next read loads the metadata.
   */
  reviveWithMetadata: WeakSet<UploadQueueItem>
  /**
   * Failed rows a refresh may still change: given up by the client, or left without their duplicate's original.
   */
  refreshMayHelp: WeakSet<UploadQueueItem>
  /**
   * Rows failed because too many reads found no asset, while the server settles them by nothing else.
   */
  givenUpMissing: WeakSet<UploadQueueItem>
  notices: WeakMap<UploadQueueItem, UploadRowNotice>
  /**
   * Shared counter for revisions and read starts.
   */
  clock: number
}

export const createUploadSettleMemory = (): UploadSettleMemory => ({
  tracked: new WeakMap(),
  revision: new WeakMap(),
  metadataLoaded: new WeakSet(),
  reviveWithMetadata: new WeakSet(),
  refreshMayHelp: new WeakSet(),
  givenUpMissing: new WeakSet(),
  notices: new WeakMap(),
  clock: 0,
})

export interface UploadSettleRow {
  queueKey: UploadQueueKey
  queue: UploadQueue
  row: UploadQueueItem
}

export interface UploadSettleOptions {
  /**
   * A row stopped being tracked, by a settlement write or by the store.
   */
  onUntrack?(queueKey: UploadQueueKey): void
  /**
   * The settlement was disposed. Results of an original read that arrive later are not written.
   */
  isDisposed?(): boolean
}

export const isFinalFileStatus = (
  status: AssetFileProcessStatusType | null | undefined
): status is 'processed' | 'duplicate' | 'failed' =>
  status === AssetFileProcessStatus.Processed ||
  status === AssetFileProcessStatus.Duplicate ||
  status === AssetFileProcessStatus.Failed

/**
 * The file state a read gives the target.
 * An asset reports only its main file state. A final state from the asset wins, otherwise the event state applies.
 * For another file (a slot) the asset says nothing, so only the event state applies.
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

// "Empty" as the queue's mass operations define it.
export const isEmptyMetadataValue = (value: unknown) =>
  isUndefined(value) || isNull(value) || value === '' || (isArray(value) && !value.length)

/**
 * First metadata load of a row. Values the user set earlier (via a queue mass operation) stay.
 * Only empty lists and empty custom fields are filled.
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
  // Not mass-operation fields. These come from the server.
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
 * Applies a read asset to a row without changing its state.
 * `hadMetadata`: the row's metadata was loaded once, whether or not the form is shown now.
 */
export function decorateRow(
  row: UploadQueueItem,
  asset: AssetDetailItemDto,
  mainFile: AssetFile,
  role: UploadRowRoleType,
  hadMetadata: boolean
) {
  row.assetStatus = asset.attributes.assetStatus
  // Only for the main-file row. A slot row would get a preview of another file.
  if (!isNull(row.fileId) && row.fileId !== mainFile.id) return
  if (mainFile.links?.image_detail) row.imagePreview = mainFile.links.image_detail
  // Skip mass-edit rows and rows that have or had metadata. There these switches are form fields the user may have set.
  // This includes a row that lost its form on failure and gets it back.
  if (!row.canEditMetadata && !hadMetadata && role !== UploadRowRole.MassEdit) {
    row.mainFileSingleUse = asset.mainFileSingleUse
    row.mainFileInternal = asset.mainFileInternal
  }
}

// Both duplicate policies mark the row through here.
const markAsDuplicate = (row: UploadQueueItem) => {
  row.isDuplicate = true
  // Set once, before anything can overwrite `assetId` with the original.
  row.uploadedAssetId ??= row.assetId
}

/**
 * Settlement writes: a read asset or a known state into queue rows.
 * No timers and no reads of its own, except reading a duplicate's original.
 */
export function createUploadSettle(
  profile: UploadSettlementProfile,
  memory: UploadSettleMemory = createUploadSettleMemory(),
  options: UploadSettleOptions = {}
) {
  const policyOf = (row: UploadQueueItem) => profile.policyFor(profile.roleOf(row))

  /**
   * Whether the target concerns a row of queue `queueKey`, by the profile's `matches`.
   * When the profile provides `configOf`, only queues of a configuration the target names match.
   */
  const concerns = (
    queueKey: UploadQueueKey,
    row: UploadQueueItem,
    target: UploadSettlementTarget,
    purpose: 'settle' | 'decorate' | 'metadata'
  ) =>
    (!profile.configOf || !target.configNames?.length || target.configNames.includes(profile.configOf(queueKey))) &&
    profile.matches(row, target, purpose)

  /**
   * Splits the target per named configuration when it names several and the profile provides `configOf`.
   * Each copy is read separately, by a queue of that configuration, and written only into its rows.
   * Otherwise returns the target itself.
   */
  const byConfiguration = (target: UploadSettlementTarget): UploadSettlementTarget[] => {
    const names = profile.configOf ? [...new Set(target.configNames ?? [])] : []
    return names.length > 1 ? names.map((name) => ({ ...target, configNames: [name] })) : [target]
  }

  // Queues whose rows got names since the caches last fetched.
  const namedQueues = new Set<UploadQueueKey>()
  /**
   * Where the row names go. A profile with `configOf` is given the queue key, one without is not.
   */
  const cachesOf = (
    queueKey: UploadQueueKey
  ): Pick<UploadSettlementProfile['caches'], 'addAuthors' | 'addKeywords'> => {
    namedQueues.add(queueKey)
    if (!profile.configOf) {
      return {
        addAuthors: (ids) => profile.caches.addAuthors(ids),
        addKeywords: (ids) => profile.caches.addKeywords(ids),
      }
    }
    return {
      addAuthors: (ids) => profile.caches.addAuthors(ids, queueKey),
      addKeywords: (ids) => profile.caches.addKeywords(ids, queueKey),
    }
  }
  /**
   * Fetches caches for each queue that got names, or once without a queue for a profile without `configOf`.
   */
  const fetchNames = () => {
    const queueKeys = [...namedQueues]
    namedQueues.clear()
    if (!profile.configOf) {
      profile.caches.fetchAuthors()
      profile.caches.fetchKeywords()
      return
    }
    for (const queueKey of queueKeys) {
      profile.caches.fetchAuthors(queueKey)
      profile.caches.fetchKeywords(queueKey)
    }
  }

  /**
   * All queue rows at this moment.
   */
  const rows = (): UploadSettleRow[] => {
    const all: UploadSettleRow[] = []
    for (const [queueKey, queue] of profile.queues()) {
      for (const row of queue.items) all.push({ queueKey, queue, row })
    }
    return all
  }

  // Nothing writes into a stopped row. Check again after every await: the row may have been stopped meanwhile.
  const isStopped = (row: UploadQueueItem) => row.status === UploadQueueItemStatus.Stop

  const isLive = (row: UploadQueueItem) => {
    const raw = toRaw(row)
    for (const [, queue] of profile.queues()) {
      if (toRaw(queue.items).some((item) => toRaw(item) === raw)) return true
    }
    return false
  }

  // A row marked as a duplicate is settled and read-only.
  // A row that became its original is a normal editable row.
  const isMarkedDuplicate = (row: UploadQueueItem) => row.isDuplicate && policyOf(row).duplicate === 'markDuplicate'
  const isDisposed = () => options.isDisposed?.() === true

  const decorate = (row: UploadQueueItem, asset: AssetDetailItemDto, mainFile: AssetFile) =>
    decorateRow(row, asset, mainFile, profile.roleOf(row), memory.metadataLoaded.has(toRaw(row)))

  const revisionOf = (row: UploadQueueItem) => memory.revision.get(toRaw(row)) ?? 0
  /**
   * An event wrote into the row. Reads started before this are stale for it.
   */
  const bump = (row: UploadQueueItem) => {
    const mark = ++memory.clock
    memory.revision.set(toRaw(row), mark)
    return mark
  }
  const isStale = (row: UploadQueueItem, startedAt: number) => startedAt <= revisionOf(row)
  /**
   * Mark of a read starting now.
   */
  const startRead = () => ++memory.clock

  const trackStateOf = (row: UploadQueueItem) => memory.tracked.get(toRaw(row))
  const untrack = (row: UploadQueueItem) => {
    const raw = toRaw(row)
    const state = memory.tracked.get(raw)
    if (!state) return
    memory.tracked.delete(raw)
    options.onUntrack?.(state.queueKey)
  }

  /**
   * Whether a refresh may still change a failed row. The store is notified on change.
   */
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
  // Whether the row message is still the text the settlement wrote.
  // The store also writes `row.error` (failed upload), and the settlement must not clear that error.
  const showsOwnText = (row: UploadQueueItem) => {
    const notice = memory.notices.get(toRaw(row))
    return !!notice?.shown && row.error.message === notice.text
  }

  /**
   * Writes the applicable settlement text into `row.error`, or removes its own text.
   * Only its own text, and only while the row still shows it.
   * `clear` also removes an error the settlement did not write, because the row settled as processed.
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
      // Remove the text. Also clear the flag, unless the row has failed since. Then the flag belongs to the failure.
      if (row.status === UploadQueueItemStatus.Failed) row.error = { ...row.error, message: '' }
      else clearRowError(row)
    }
    notice.shown = null
    notice.text = null
  }

  const loadMetadata = (
    { queueKey, queue, row }: Pick<UploadSettleRow, 'queueKey' | 'queue' | 'row'>,
    asset: AssetDetailItemDto
  ) => {
    mergeLoadedMetadata(queue, row, asset, cachesOf(queueKey))
    memory.metadataLoaded.add(toRaw(row))
  }

  const settleProcessed = (
    { queueKey, queue, row }: UploadSettleRow,
    asset: AssetDetailItemDto,
    mainFile: AssetFile,
    intent: UploadReadIntent
  ) => {
    const raw = toRaw(row)
    // The client marks an upload failed when one of its requests fails, but the server may still finish it.
    // Such a row lost its form on failure and gets it back here, with its metadata.
    const wasFailed = row.status === UploadQueueItemStatus.Failed || memory.reviveWithMetadata.has(raw)
    row.status = UploadQueueItemStatus.Uploaded
    // A licence copy knows only its asset. The image is built from the file id.
    if (isNull(row.fileId)) row.fileId = mainFile.id
    decorate(row, asset, mainFile)
    const notice = noticeOf(row)
    if (policyOf(row).metadata === 'load' && !isMarkedDuplicate(row) && (intent.metadata || wasFailed)) {
      // Loaded once, and never into a row with the form shown, so user input is kept.
      if (!row.canEditMetadata && !memory.metadataLoaded.has(raw)) loadMetadata({ queueKey, queue, row }, asset)
      row.canEditMetadata = true
      notice.readWarning = false
      profile.hooks.afterMetadataLoaded?.(queueKey, row)
    }
    memory.reviveWithMetadata.delete(raw)
    memory.givenUpMissing.delete(raw)
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
    // Drop the old text. The row shows a message for the reason, and the old text is not the cause.
    row.error = { hasError: true, message: '', assetFileFailReason: failReason }
    row.canEditMetadata = false
    dropNotice(row)
    memory.reviveWithMetadata.delete(toRaw(row))
    memory.givenUpMissing.delete(toRaw(row))
    setRefreshMayHelp(queueKey, row, false)
    untrack(row)
    profile.hooks.onRowFinal(queueKey, row)
  }

  /**
   * A failure known by the caller, without a read.
   */
  const settleKnownFailed = (target: UploadSettlementTarget, failReason: AssetFileFailReasonType) => {
    for (const entry of rows()) {
      if (entry.row.status === UploadQueueItemStatus.Stop || !concerns(entry.queueKey, entry.row, target, 'settle')) {
        continue
      }
      settleFailed(entry, failReason)
      bump(entry.row)
    }
  }

  /**
   * Applies a `processed` event immediately to rows that settle on the event.
   * A tick also uses it for a slot row whose file the slot list shows processed.
   */
  const settleProcessedByEvent = (target: UploadSettlementTarget) => {
    for (const { queueKey, row } of rows()) {
      if (row.status === UploadQueueItemStatus.Stop || policyOf(row).settleOn !== 'event') continue
      if (!concerns(queueKey, row, target, 'settle')) continue
      const raw = toRaw(row)
      if (row.status === UploadQueueItemStatus.Failed) memory.reviveWithMetadata.add(raw)
      memory.givenUpMissing.delete(raw)
      row.status = UploadQueueItemStatus.Uploaded
      // A row the client gave up on that already had metadata gets its form back as the user left it.
      if (!isMarkedDuplicate(row) && memory.metadataLoaded.has(raw)) row.canEditMetadata = true
      noticeOf(row).slow = false
      syncNotice(row, { clear: true })
      bump(row)
      setRefreshMayHelp(queueKey, row, false)
      untrack(row)
      profile.hooks.onRowFinal(queueKey, row)
    }
  }

  /**
   * Handles a `processed` event for rows whose state it does not change.
   */
  const announceProcessed = (target: UploadSettlementTarget) => {
    for (const { queueKey, row } of rows()) {
      if (row.status === UploadQueueItemStatus.Stop || policyOf(row).settleOn !== 'never') continue
      if (concerns(queueKey, row, target, 'decorate')) profile.hooks.onProcessedSeen?.(queueKey, row)
    }
  }

  const duplicateRows = (
    target: UploadSettlementTarget,
    policy: 'becomeOriginal' | 'markDuplicate',
    eligible: (row: UploadQueueItem) => boolean
  ) =>
    rows().filter(
      ({ queueKey, row }) =>
        row.status !== UploadQueueItemStatus.Stop &&
        eligible(row) &&
        policyOf(row).duplicate === policy &&
        concerns(queueKey, row, target, 'settle')
    )

  // The row stays and is marked. It is settled first and completed from the original file later.
  // This way the wait for that file does not hold an upload slot.
  const markDuplicates = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null,
    eligible: (row: UploadQueueItem) => boolean
  ) => {
    const marked: Array<{ row: UploadQueueItem; mark: number }> = []
    for (const { queueKey, row } of duplicateRows(target, 'markDuplicate', eligible)) {
      markAsDuplicate(row)
      row.status = UploadQueueItemStatus.Uploaded
      row.canEditMetadata = false
      clearRowError(row)
      dropNotice(row)
      memory.reviveWithMetadata.delete(toRaw(row))
      memory.givenUpMissing.delete(toRaw(row))
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
      // Only rows still present and not written into meanwhile.
      if (!isLive(row) || row.status === UploadQueueItemStatus.Stop || !row.isDuplicate) continue
      if (revisionOf(row) !== mark) continue
      row.fileId = file.id
      row.duplicateAssetId = file.asset
      row.mainFileSingleUse = file.flags.singleUse
      if (file.links?.image_detail) row.imagePreview = file.links.image_detail
    }
  }

  // The row becomes the original: its asset and file are replaced and it takes the original's metadata.
  // Returns whether the original could not be read and a row remains that a refresh may still help.
  const becomeOriginals = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null,
    eligible: (row: UploadQueueItem) => boolean
  ): Promise<boolean> => {
    if (!originFileId || assetType !== DamAssetType.Image) return false
    // Recorded before requesting the original. After the await, only rows still in
    // their queue, not stopped and not written by an event meanwhile are written.
    // The caller that reports a duplicate is outside the read
    // ordering, so an earlier answer must not undo a later event.
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
      original = await profile.readers.duplicateOriginAsset(originFileId, { queueKey: candidates[0]!.queueKey })
    } catch {
      if (isDisposed()) return false
      let leftWithout = false
      for (const { queueKey, row } of untouched()) {
        // Read before untracking, so a row the client gave up on keeps its way back.
        const mightHelp = memory.refreshMayHelp.has(toRaw(row))
        // Untrack regardless of state. The next tick would only retry the same read.
        untrack(row)
        // Only a row still waiting for this answer fails: a settled one must not be flipped back to failed.
        const failsHere = row.status === UploadQueueItemStatus.Processing
        if (failsHere) {
          row.status = UploadQueueItemStatus.Failed
          // Drop a text the settlement wrote. It no longer describes what is wrong with the row.
          row.error = { ...row.error, hasError: true, message: showsOwnText(row) ? '' : row.error.message }
          row.canEditMetadata = false
          dropNotice(row)
          profile.hooks.onRowFinal(queueKey, row)
        }
        // Failed because a read failed, not the file. A row refresh requests the original again.
        // Not for a row the server had already failed, which no refresh can undo.
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
      markAsDuplicate(row)
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
      const caches = cachesOf(queueKey)
      caches.addKeywords(row.keywords)
      caches.addAuthors(row.authors)
      caches.addAuthors(row.authorConflicts)
      row.assetId = original.id
      row.mainFileSingleUse = original.mainFileSingleUse
      row.mainFileInternal = original.mainFileInternal
      memory.metadataLoaded.add(toRaw(row))
      row.canEditMetadata = true
      dropNotice(row)
      memory.reviveWithMetadata.delete(toRaw(row))
      memory.givenUpMissing.delete(toRaw(row))
      bump(row)
      setRefreshMayHelp(queueKey, row, false)
      untrack(row)
      profile.hooks.onRowFinal(queueKey, row)
    }
    fetchNames()
    return false
  }

  /**
   * Handles a duplicate file for every row passing `matches(…, 'settle')`, by the policy of its role.
   * `eligible` excludes rows the read is stale for.
   * Returns whether a row is left without its duplicate's original
   * because it could not be read. A refresh may still help it.
   */
  const settleDuplicate = async (
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null,
    eligible: (row: UploadQueueItem) => boolean = () => true
  ) => {
    // Both start at once, not one after the other, so each records its rows now.
    // The original is read once per configuration the target names, by a queue of that configuration.
    const targets = byConfiguration(target)
    const [, leftWithout] = await Promise.all([
      markDuplicates(target, originFileId, assetType, eligible),
      targets.length === 1
        ? becomeOriginals(target, originFileId, assetType, eligible)
        : Promise.all(targets.map((one) => becomeOriginals(one, originFileId, assetType, eligible))).then((left) =>
            left.some(Boolean)
          ),
    ])
    return leftWithout
  }

  /**
   * A duplicate known by the caller, without reading its asset. Never rejects.
   */
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

  /**
   * Metadata notification: loads the metadata and the form, regardless of the file state.
   */
  const tryLoadMetadata = ({ queueKey, queue, row }: UploadSettleRow, asset: AssetDetailItemDto) => {
    if (policyOf(row).metadata !== 'load' || row.canEditMetadata) return
    // A marked duplicate is settled and has no metadata of its own to load.
    if (isMarkedDuplicate(row)) return
    // Skip a row whose file failed, except one that failed for lack of this metadata.
    if (row.status === UploadQueueItemStatus.Failed && profile.metadataGate?.(queueKey, row) !== 'load') return
    if (!memory.metadataLoaded.has(toRaw(row))) loadMetadata({ queueKey, queue, row }, asset)
    row.canEditMetadata = true
    noticeOf(row).readWarning = false
    syncNotice(row)
    profile.hooks.afterMetadataLoaded?.(queueKey, row)
  }

  /**
   * Applies one read asset to every row it concerns. `startedAt` is the read mark.
   * A row written by an event since keeps the event's state.
   * Returns like `settleDuplicate`: whether a row is left without its duplicate's original.
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
      // The duplicate's original read was awaited. The row may have left its queue meanwhile.
      if (duplicateSettled && !isLive(row)) continue
      if (isStopped(row)) continue

      // Apply the file state and row details unless an event wrote
      // into the row after this read started. The event is newer.
      if (!isStale(row, startedAt) && mainFile && concerns(queueKey, row, target, 'decorate')) {
        const maySettle = concerns(queueKey, row, target, 'settle')
        if (status === AssetFileProcessStatus.Processed) {
          if (policyOf(row).settleOn === 'never') {
            decorate(row, asset, mainFile)
            if (intent.seen) profile.hooks.onProcessedSeen?.(queueKey, row)
          } else if (maySettle) {
            settleProcessed(entry, asset, mainFile, intent)
          }
        } else if (status === AssetFileProcessStatus.Duplicate && maySettle) {
          // Once for all rows of the target. The original is read only once.
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

      // Applied to such a row as well, because metadata is not file state. It loads once, whenever it arrives.
      // Rows the event failed or marked as duplicate are refused there.
      // Otherwise a `processed` event that overtakes the metadata read would leave the row uploaded without its form.
      if (intent.early && concerns(queueKey, row, target, 'metadata')) tryLoadMetadata(entry, asset)
    }
    profile.hooks.onAssetRead?.(asset)
    return leftWithout
  }

  /**
   * An uploaded row without its metadata, which a refresh would load.
   * It is no longer tracked, but reads that find no asset are still counted for it.
   */
  const awaitsMetadata = (row: UploadQueueItem) =>
    row.status === UploadQueueItemStatus.Uploaded &&
    !row.canEditMetadata &&
    policyOf(row).metadata === 'load' &&
    !isMarkedDuplicate(row)

  /**
   * The row's asset was missing from enough reads, for a tracked row or one a refresh may still help.
   * A processing row fails. An uploaded row without metadata fails with `assetGone`.
   * Any other row (given up by the client, or left without its duplicate's original) is left alone.
   */
  const giveUpOnMissing = ({ queueKey, row }: Pick<UploadSettleRow, 'queueKey' | 'row'>) => {
    // There is no asset a refresh could read.
    setRefreshMayHelp(queueKey, row, false)
    const withoutMetadata = awaitsMetadata(row)
    if (row.status !== UploadQueueItemStatus.Processing && !withoutMetadata) {
      untrack(row)
      return
    }
    row.status = UploadQueueItemStatus.Failed
    row.error.hasError = true
    row.error.message = withoutMetadata
      ? (profile.messages.assetGone?.(row) ?? profile.messages.assetMissing(row))
      : profile.messages.assetMissing(row)
    row.canEditMetadata = false
    memory.givenUpMissing.add(toRaw(row))
    dropNotice(row)
    untrack(row)
    profile.hooks.onRowFinal(queueKey, row)
  }

  return {
    memory,
    policyOf,
    concerns,
    byConfiguration,
    fetchNames,
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
    awaitsMetadata,
    giveUpOnMissing,
  }
}

export type UploadSettle = ReturnType<typeof createUploadSettle>
