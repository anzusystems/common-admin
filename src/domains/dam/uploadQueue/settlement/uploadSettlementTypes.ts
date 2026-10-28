import type { DocId, DocIdNullable, IntegerId } from '@/shared/types/common'
import type { AssetDetailItemDto, DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { AssetFileFailReasonType, AssetFileNullable } from '@/domains/dam/types/AssetFile'
import type { UploadQueue, UploadQueueItem, UploadQueueKey } from '@/domains/dam/types/UploadQueue'

export const UploadRowRole = {
  Upload: 'upload',
  Slot: 'slot',
  MassEdit: 'massEdit',
  Copy: 'copy',
  ExternalImport: 'externalImport',
} as const
export type UploadRowRoleType = (typeof UploadRowRole)[keyof typeof UploadRowRole]

export interface UploadSettlePolicy {
  /** How a tick reads the state of the row's file. `none`: the row is never tracked. */
  reader: 'asset' | 'slots' | 'none'
  /**
   * Applies to the `processed` state only.
   * `read`: uploaded only after a read; the event just starts the read.
   * `event`: the event state is written at once; the read completes the row.
   * `never`: `processed` does not change the row state (mass edit), it only completes
   * it. `failed` and `duplicate` apply to every row matching `matches(…, 'settle')`.
   */
  settleOn: 'read' | 'event' | 'never'
  duplicate: 'becomeOriginal' | 'markDuplicate'
  /** `load`: the row gets a form, and its metadata is loaded into it. */
  metadata: 'load' | 'none'
}

export interface UploadSettlementTarget {
  assetId: DocId
  /** `null` when the caller does not know the file. */
  fileId: DocIdNullable
  /**
   * DAM configurations of the target. With `configOf`, rows in queues of other configurations are not concerned.
   * Omitted or empty: rows of every queue. Two DAMs may share an asset id.
   */
  configNames?: string[]
}

/** Per-request options a reader may honour. A reader that ignores them keeps its old behaviour. */
export interface UploadReadOptions {
  /**
   * Whether a failure of this request should be reported to the app error collector.
   * Polls and notifications retry while a row waits, so only the first failure of a streak is
   * `true`. An answered read ends the streak; with `configOf`, streaks are per configuration.
   * A streak starts only with a failure that was written down (`readers.failureReported`).
   * A 404 counts as such, so it is `true` at most once per row.
   * A user-requested refresh is always `true`.
   */
  report: boolean
  /**
   * The queue the read is for: the polled queue, or for notification
   * and refresh reads the queue of the first concerned row.
   * Lets a reader use the queue's configuration. Omitted when the read concerns no row.
   */
  queueKey?: UploadQueueKey
}

export interface UploadSettlementProfile {
  /** Live view of the store's queues. The settlement keeps no rows and always asks. */
  queues(): Iterable<[UploadQueueKey, UploadQueue]>
  /**
   * DAM configuration of the queue. With it, named targets and
   * events concern only rows of their configurations' queues.
   * Each such read runs once per named configuration, through the queue of its first concerned
   * row, and writes only into those rows. A configuration with no row of the asset is not read.
   * Reads run sequentially per configuration, in parallel across configurations (unnamed reads get
   * their own lane), each with its own failure streak. Caches get the queue of the named rows.
   * Without it, every row of the asset is concerned, all reads share one lane and streak, and caches get no queue.
   */
  configOf?(queueKey: UploadQueueKey): string
  roleOf(row: UploadQueueItem): UploadRowRoleType
  policyFor(role: UploadRowRoleType): UploadSettlePolicy
  /**
   * `settle`: the row may get a new state. `decorate`: it may be completed without a state change.
   * `metadata`: it may get metadata from the metadata notification.
   */
  matches(row: UploadQueueItem, target: UploadSettlementTarget, purpose: 'settle' | 'decorate' | 'metadata'): boolean

  readers: {
    /** One asset; `null` when it does not exist (404). Throws only when the request fails. */
    asset(assetId: DocId, options?: UploadReadOptions): Promise<AssetDetailItemDto | null>
    /** Assets of one licence. The missing ones are not in the answer. An answer that is no list throws. */
    assets(licenceId: IntegerId, assetIds: DocId[], options?: UploadReadOptions): Promise<AssetDetailItemDto[]>
    /** DAM: the files of all the slots of an asset. An answer that is no list throws. */
    slotFiles?(assetId: DocId, options?: UploadReadOptions): Promise<AssetFileNullable[]>
    /**
     * LIB: the asset the original file of a duplicate belongs to. `queueKey`: of the first row that is to become it.
     */
    duplicateOriginAsset?(
      originFileId: DocId,
      options?: Pick<UploadReadOptions, 'queueKey'>
    ): Promise<AssetDetailItemDto>
    /** DAM: the original file of a duplicate, by its type. */
    duplicateOriginFile?(originFileId: DocId, assetType: DamAssetTypeType): Promise<AssetFileNullable>
    /**
     * Whether a failure of a read with `report: true` was written
     * down, judged by the thrown error, e.g. `apiErrorIsReported`.
     * If not (timeout, 401, 403), nobody was told and the next read may
     * report again. Without this, every failure counts as written down.
     */
    failureReported?(error: unknown): boolean
  }
  /**
   * `queueKey` is passed as the second argument only to a profile with `configOf`.
   * Wrap a `defineCached` `add`, which treats every argument as an id.
   * Such a profile is asked to fetch once per queue whose rows got
   * names since its last fetch. Without `configOf`, calls get no queue.
   */
  caches: {
    addAuthors(ids: DocId[], queueKey?: UploadQueueKey): void
    addKeywords(ids: DocId[], queueKey?: UploadQueueKey): void
    fetchAuthors(queueKey?: UploadQueueKey): void
    fetchKeywords(queueKey?: UploadQueueKey): void
  }
  messages: {
    processingTooLong(row: UploadQueueItem): string
    readFailed(row: UploadQueueItem): string
    assetMissing(row: UploadQueueItem): string
    /**
     * Fail text for an uploaded row without metadata whose asset
     * was missing from too many reads. Defaults to `assetMissing`.
     */
    assetGone?(row: UploadQueueItem): string
  }
  /**
   * `'load'`: the row may get metadata from the notification although it failed. `undefined`: default rules.
   * DAM: a mass-edit row its batch load left out.
   */
  metadataGate?(queueKey: UploadQueueKey, row: UploadQueueItem): 'load' | undefined
  hooks: {
    /** The row has reached a final state: count the queue again and start the next waiting upload. */
    onRowFinal(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /** After every asset that was read (DAM: the main file for the open detail). */
    onAssetRead?(asset: AssetDetailItemDto): void
    /** A row with `settleOn: 'never'` has learnt its file is processed (an event, a tick or a manual read). */
    onProcessedSeen?(queueKey: UploadQueueKey, row: UploadQueueItem): void
    afterMetadataLoaded?(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /**
     * Whether a refresh may still change a failed row; called when
     * that changes, for stores that offer refresh only where it helps.
     * `true`: tracked despite `clientFailed: true`, or a duplicate whose original could not be read.
     * `false`: the server settled the file, the asset was missing too
     * often, or the store removed the row (`untrack`, `dropQueue`).
     * Never `false` without a prior `true`. Not called by `dispose()`.
     */
    onRefreshMayHelp?(queueKey: UploadQueueKey, row: UploadQueueItem, mayHelp: boolean): void
  }
  connection: {
    /**
     * Whether notifications arrive for the queue's rows; the poll is then
     * only a backup. A profile with one shared state may ignore `queueKey`.
     */
    isPushAlive(queueKey?: UploadQueueKey): boolean
    /** Called whenever that may have changed, for any queue. */
    onChange(callback: () => void): () => void
  }
}

export interface UploadSettlementEvent {
  kind: 'processed' | 'failed' | 'duplicate' | 'metadata' | 'copied'
  assetId: DocId
  /** `event.data.id` */
  fileId: DocIdNullable
  failReason?: AssetFileFailReasonType
  originAssetFile?: DocIdNullable
  assetType?: DamAssetTypeType | null
  /** DAM configurations of the event, as on `UploadSettlementTarget`. Omitted: every queue. */
  configNames?: string[]
}

/**
 * `settled`: the main file is final, or the asset was missing too often and its rows were given up. `pending`: not yet.
 * Retryable: `error` (read failed), `missing` (asset not found),
 * `originalUnread` (duplicate's original could not be read).
 */
export type UploadRefreshOutcome = 'settled' | 'pending' | 'error' | 'missing' | 'originalUnread'

export interface UploadSettlement {
  /** The row starts waiting for the server. Ignored if the row is not in `queueKey`. */
  track(queueKey: UploadQueueKey, row: UploadQueueItem, options?: { clientFailed?: boolean }): void
  untrack(row: UploadQueueItem): void
  /** The queue was cleared: its poller is dropped. */
  dropQueue(queueKey: UploadQueueKey): void

  /** A notification. Resolves after the write (a delayed read included) or after a failed read; never rejects. */
  notify(event: UploadSettlementEvent): Promise<void>
  /**
   * Manual refresh: an immediate read with metadata and no hint.
   * With `configOf`, a named configuration with no row of the asset is not read (`settled`). With several,
   * returns the first of `error`, `originalUnread`, `missing`, `pending`, `settled` any read had.
   */
  refreshAsset(target: UploadSettlementTarget): Promise<UploadRefreshOutcome>
  /** The caller knows the file is processed: a read at once, with the hint `processed`. */
  settleKnownProcessed(target: UploadSettlementTarget, options: { withMetadata: boolean }): Promise<void>
  /** Settles a known duplicate without reading the asset: the `duplicate` event, or a copy the licence already has. */
  settleKnownDuplicate(
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null
  ): Promise<void>
  /** A known failure, without a read. Synchronous. */
  settleKnownFailed(target: UploadSettlementTarget, failReason: AssetFileFailReasonType): void

  /** The row failed because too many reads found no asset, and the server has not settled it otherwise since. */
  isGivenUpMissing(row: UploadQueueItem): boolean
  hasTracked(): boolean
  dispose(): void
}
