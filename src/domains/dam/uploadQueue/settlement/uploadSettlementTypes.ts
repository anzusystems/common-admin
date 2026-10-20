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
  /** What a tick reads the state of the row's file with. `none`: the row is never tracked. */
  reader: 'asset' | 'slots' | 'none'
  /**
   * For the `processed` state ONLY.
   * `read`: uploaded only from a read, the event merely starts that read.
   * `event`: the state of the event is written at once, the read completes the row.
   * `never`: `processed` does not change the state of the row (mass edit), it only completes it.
   * `failed` and `duplicate` are written to every row that passes `matches(…, 'settle')`.
   */
  settleOn: 'read' | 'event' | 'never'
  duplicate: 'becomeOriginal' | 'markDuplicate'
  /** `load`: the row is to have a form, and its metadata is loaded into it. */
  metadata: 'load' | 'none'
}

export interface UploadSettlementTarget {
  assetId: DocId
  /** The file the event or the read speaks of; `null` when the caller does not know it. */
  fileId: DocIdNullable
}

/** What the settlement says of one request it asks a reader for. A reader that ignores it behaves as before. */
export interface UploadReadOptions {
  /**
   * Whether a failure of this request is to be reported to whoever collects the errors of the application.
   *
   * The poll and the notifications ask again and again for as long as a row waits, so of their requests only
   * the first that fails in a streak is `true`; a read that answers ends the streak. The streak begins with a
   * failure that was written down (`readers.failureReported`): after one that was not, the next request is
   * `true` again. An asset that does not exist (404) counts as such a failure: it is `true` once per row at most.
   * A read the user asked for (the refresh) is always `true`.
   */
  report: boolean
  /**
   * The queue the read is for: of the poll its own queue; of a read a notification or the refresh asked for, the
   * queue of the first row it concerns. For a reader that asks under the configuration of the queue. Not given when
   * the read concerns no row.
   */
  queueKey?: UploadQueueKey
}

/** What a store hands its settlement. */
export interface UploadSettlementProfile {
  /** A live view of the queues of the store. The settlement keeps no rows, it always asks. */
  queues(): Iterable<[UploadQueueKey, UploadQueue]>
  roleOf(row: UploadQueueItem): UploadRowRoleType
  policyFor(role: UploadRowRoleType): UploadSettlePolicy
  /**
   * `settle`: the row may be given a state. `decorate`: it may be completed without a change of state.
   * `metadata`: it may be given its metadata from the metadata notification.
   */
  matches(row: UploadQueueItem, target: UploadSettlementTarget, purpose: 'settle' | 'decorate' | 'metadata'): boolean

  readers: {
    /** One asset; `null` when it does not exist (404). Throws only when the request fails. */
    asset(assetId: DocId, options?: UploadReadOptions): Promise<AssetDetailItemDto | null>
    /** Assets of one licence. The missing ones are not in the answer. An answer that is no list throws. */
    assets(licenceId: IntegerId, assetIds: DocId[], options?: UploadReadOptions): Promise<AssetDetailItemDto[]>
    /** DAM: the files of all the slots of an asset. An answer that is no list throws. */
    slotFiles?(assetId: DocId, options?: UploadReadOptions): Promise<AssetFileNullable[]>
    /** LIB: the asset the original file of a duplicate belongs to. `queueKey`: of the first row that is to become it. */
    duplicateOriginAsset?(
      originFileId: DocId,
      options?: Pick<UploadReadOptions, 'queueKey'>
    ): Promise<AssetDetailItemDto>
    /** DAM: the original file of a duplicate, by its type. */
    duplicateOriginFile?(originFileId: DocId, assetType: DamAssetTypeType): Promise<AssetFileNullable>
    /**
     * Whether a failure of a read that was let report (`report: true`) was written down, by what the read threw:
     * `apiErrorIsReported` for readers that report through the api error logger. One that was not (a timeout, a
     * 401, a 403) has told nobody, and the next read is let report again. Without it, every such failure was.
     */
    failureReported?(error: unknown): boolean
  }
  caches: {
    addAuthors(ids: DocId[]): void
    addKeywords(ids: DocId[]): void
    fetchAuthors(): void
    fetchKeywords(): void
  }
  messages: {
    processingTooLong(row: UploadQueueItem): string
    readFailed(row: UploadQueueItem): string
    assetMissing(row: UploadQueueItem): string
    /**
     * The text of an uploaded row still without its metadata whose asset was missing from as many reads as it
     * takes: it fails with it. Without it, `assetMissing`.
     */
    assetGone?(row: UploadQueueItem): string
  }
  /**
   * `'load'`: this row may be given its metadata from the notification although it has failed. `undefined`: the
   * default rules. DAM: a mass-edit row its batch load left out.
   */
  metadataGate?(queueKey: UploadQueueKey, row: UploadQueueItem): 'load' | undefined
  hooks: {
    /** The row has reached a final state: count the queue again and start the next waiting upload. */
    onRowFinal(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /** After every asset that was read (DAM: the main file for the open detail). */
    onAssetRead?(asset: AssetDetailItemDto): void
    /** A row with `settleOn: 'never'` has learnt its file is processed (an event, a tick or a manual read). */
    onProcessedSeen?(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /** The row was given its metadata. */
    afterMetadataLoaded?(queueKey: UploadQueueKey, row: UploadQueueItem): void
    /**
     * Whether a refresh may still change a failed row, told whenever that changes. For a store that offers
     * refresh on a failed row only where it can help.
     *
     * `true`: the row is asked about although the client gave it up (`track(…, { clientFailed: true })`), or its
     * file is a duplicate whose original could not be read. `false`: the server has said what became of the file
     * (processed, failed, a duplicate that was settled), its asset is gone from as many reads as it takes, or the
     * store took the row out (`untrack`, `dropQueue`). A row never told `true` is never told `false`. Not called
     * by `dispose()`.
     */
    onRefreshMayHelp?(queueKey: UploadQueueKey, row: UploadQueueItem, mayHelp: boolean): void
  }
  connection: {
    isPushAlive(): boolean
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
}

/**
 * `settled`: the main file is in a final state, or its asset was missing once too often and its rows were given
 * up. `pending`: not yet. And what asking again may mend: `error`, the read failed; `missing`, the asset was not
 * found; `originalUnread`, a row is left without the original of its duplicate, which could not be read.
 */
export type UploadRefreshOutcome = 'settled' | 'pending' | 'error' | 'missing' | 'originalUnread'

/** What a store uses. */
export interface UploadSettlement {
  /** The row began to wait for the server. A row that is not in the queue `queueKey` is ignored. */
  track(queueKey: UploadQueueKey, row: UploadQueueItem, options?: { clientFailed?: boolean }): void
  untrack(row: UploadQueueItem): void
  /** The queue was cleared: its poller is dropped. */
  dropQueue(queueKey: UploadQueueKey): void

  /** A notification. Resolves after the write (a delayed read included) or after a failed read; never rejects. */
  notify(event: UploadSettlementEvent): Promise<void>
  /** The manual refresh: a read at once, with the metadata, without a hint. */
  refreshAsset(target: UploadSettlementTarget): Promise<UploadRefreshOutcome>
  /** The caller knows the file is processed: a read at once, with the hint `processed`. */
  settleKnownProcessed(target: UploadSettlementTarget, options: { withMetadata: boolean }): Promise<void>
  /** A known duplicate without a read of the asset: the `duplicate` event, and a copy the licence already has. */
  settleKnownDuplicate(
    target: UploadSettlementTarget,
    originFileId: DocIdNullable,
    assetType: DamAssetTypeType | null
  ): Promise<void>
  /** A known failure, without a read. Synchronous. */
  settleKnownFailed(target: UploadSettlementTarget, failReason: AssetFileFailReasonType): void

  /**
   * The row failed by the read that was one too many to find no asset of it (the poll's, a notification's, a
   * refresh's), and the server has settled it by nothing else since.
   */
  isGivenUpMissing(row: UploadQueueItem): boolean
  hasTracked(): boolean
  dispose(): void
}
