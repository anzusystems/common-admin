import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import type {
  UploadQueue,
  UploadQueueItem,
  UploadQueueItemStatusType,
  UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import type {
  uploadSide,
  UploadProgressCallback,
  UploadRun,
  UploadSide,
} from '@/domains/dam/uploadQueue/presets/uploadPresets'
import type {
  UploadRowRoleType,
  UploadSettlement,
  UploadSettlementProfile,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'

// Not exported from the library: only its own functions put the members on a set of the core.
export const uploadQueuePresetMembers = Symbol('uploadQueuePresetMembers')

/** The settlement profile of a store (step 2). The core adds `queues` and, after `hooks.onRowFinal`, counts the queue and starts the next row. */
export type UploadQueueSettlementProfile = Omit<UploadSettlementProfile, 'queues' | 'hooks'> & {
  hooks?: Partial<UploadSettlementProfile['hooks']>
}

/** The queues of a store as the core reads and writes them, from the state of the store at that moment. */
export interface UploadQueueContainer {
  get(queueKey: UploadQueueKey): UploadQueue | undefined
  set(queueKey: UploadQueueKey, queue: UploadQueue): void
  entries(): Iterable<[UploadQueueKey, UploadQueue]>
}

/** What a failed run writes into its row, and the alert sent once the row is marked. */
export interface UploadQueueClientFailure {
  message: string
  alert(): void
}

interface UploadQueuePresetMembers<S extends UploadSide> {
  queues: UploadQueueContainer
  settlement: UploadQueueSettlementProfile
  /** What sends the row: an upload, or in admin-dam the import of a row of an external provider. */
  runnerFor(
    item: UploadQueueItem,
    queueKey: UploadQueueKey
  ): (item: UploadQueueItem, onProgress: UploadProgressCallback) => UploadRun<S>
  /** Read before the core writes anything into the failed row. */
  onClientFailure?(queueKey: UploadQueueKey, item: UploadQueueItem, error: unknown): UploadQueueClientFailure
  rowTracked?(queueKey: UploadQueueKey, item: UploadQueueItem): void
  rowRemoved?(queueKey: UploadQueueKey, item: UploadQueueItem): void
  /** Whether the core keeps the failed rows a refresh may still change. */
  refreshable: boolean
}

/** What a store hands its core. Made only by `libraryQueuePreset()` and `adminDamQueuePreset()`. */
export interface UploadQueuePreset<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
  readonly [uploadQueuePresetMembers]: UploadQueuePresetMembers<S>
}

export interface UploadQueueCore {
  settlement: UploadSettlement
  roleOf(item: UploadQueueItem): UploadRowRoleType

  getQueue(queueKey: UploadQueueKey): UploadQueue | null
  getQueueItems(queueKey: UploadQueueKey): UploadQueueItem[]
  getQueueItemsByStatus(queueKey: UploadQueueKey, status: UploadQueueItemStatusType): UploadQueueItem[]
  getQueueTotalCount(queueKey: UploadQueueKey): number
  getQueueProcessedCount(queueKey: UploadQueueKey): number
  getQueueFileInputKey(queueKey: UploadQueueKey): number
  getQueueItemsTypes(queueKey: UploadQueueKey): DamAssetTypeType[]

  /** `prefix` and a number no other row of this page has. */
  uniqueKey(prefix: string): string
  createQueue(queueKey: UploadQueueKey): void
  addQueueItem(queueKey: UploadQueueKey, item: UploadQueueItem): void
  /** Makes the queue if need be, adds the row, counts, starts what may start. */
  addRow(queueKey: UploadQueueKey, item: UploadQueueItem): void
  recalculateQueueCounts(queueKey: UploadQueueKey): void
  setUploadSpeed(item: UploadQueueItem, progress: number, speed: number, estimate: number): void
  forceReloadFileInput(queueKey: UploadQueueKey): void

  processUpload(queueKey: UploadQueueKey): void
  queueItemUploadStart(item: UploadQueueItem, queueKey: UploadQueueKey): Promise<void>
  track(queueKey: UploadQueueKey, item: UploadQueueItem, options?: { clientFailed?: boolean }): void

  removeByIndex(queueKey: UploadQueueKey, index: number): void
  stopItemUpload(queueKey: UploadQueueKey, item: UploadQueueItem): void
  stopUpload(queueKey: UploadQueueKey): void
  clearQueue(queueKey: UploadQueueKey): void

  /** Whether a refresh may still change a failed row. Filled only with the library's preset. */
  refreshMayHelp(item: UploadQueueItem): boolean
}
