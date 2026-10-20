import type { Ref } from 'vue'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import {
  libraryUploadPreset,
  type UploadProgressCallback,
  type UploadRun,
  uploadSide,
} from '@/domains/dam/uploadQueue/presets/uploadPresets'
import {
  type UploadQueueContainer,
  type UploadQueuePreset,
  uploadQueuePresetMembers,
  type UploadQueueSettlementProfile,
} from '@/domains/dam/uploadQueue/core/uploadQueueCoreTypes'

const mapQueues = (queues: Ref<Map<UploadQueueKey, UploadQueue>>): UploadQueueContainer => ({
  get: (queueKey) => queues.value.get(queueKey),
  set: (queueKey, queue) => {
    queues.value.set(queueKey, queue)
  },
  entries: () => queues.value.entries(),
})

// By `in`, as the store has always looked: a key named after a member of `Object.prototype` finds that member.
const objectQueues = (queues: Ref<Record<UploadQueueKey, UploadQueue>>): UploadQueueContainer => ({
  get: (queueKey) => (queueKey in queues.value ? queues.value[queueKey] : undefined),
  set: (queueKey, queue) => {
    queues.value[queueKey] = queue
  },
  entries: () => Object.entries(queues.value),
})

/** Not exported from `src/lib.ts`: only the library store uses it. Every row is uploaded, under the configuration of its queue. */
export function libraryQueuePreset(store: {
  queues: Ref<Map<UploadQueueKey, UploadQueue>>
  settlement: UploadQueueSettlementProfile
  /** The DAM configuration the queue was made under, `default` for one the store does not know. */
  configOf(queueKey: UploadQueueKey): string
}): UploadQueuePreset<'library'> {
  return {
    [uploadSide]: 'library',
    [uploadQueuePresetMembers]: {
      queues: mapQueues(store.queues),
      settlement: store.settlement,
      runnerFor: (_item, queueKey) => (item, onProgress) =>
        useUpload(item, onProgress, libraryUploadPreset(store.configOf(queueKey))),
      refreshable: true,
    },
  }
}

/** admin-dam's queue: what it shows and does that the library does not. The store hands in what is its own. */
export function adminDamQueuePreset(store: {
  queues: Ref<Record<UploadQueueKey, UploadQueue>>
  settlement: UploadQueueSettlementProfile
  /** `useUpload` of admin-dam's `uploadService.ts`. */
  upload(item: UploadQueueItem, onProgress: UploadProgressCallback): UploadRun<'adminDam'>
  /** The run of an `ExternalProviderAsset` row: `adminDamImportRun(externalProviderImport(item).importInit)`. */
  importRun(item: UploadQueueItem): UploadRun<'adminDam'>
  /** `resolveUploadErrorMessage`: the text of a failed upload. */
  failureMessage(error: unknown): string
  /** `showError` of the store's `useAlerts()`: one alert per reason. */
  alert(message: string): void
  /** `handedOver.add(toRaw(item))`. */
  rowTracked(queueKey: UploadQueueKey, item: UploadQueueItem): void
  /** `metadataFailures.delete(metadataFailureKey(queueKey, item))`. */
  rowRemoved(queueKey: UploadQueueKey, item: UploadQueueItem): void
}): UploadQueuePreset<'adminDam'> {
  const queues = objectQueues(store.queues)
  return {
    [uploadSide]: 'adminDam',
    [uploadQueuePresetMembers]: {
      queues,
      settlement: store.settlement,
      runnerFor: (item) =>
        item.type === UploadQueueItemType.ExternalProviderAsset
          ? (row) => store.importRun(row)
          : (row, onProgress) => store.upload(row, onProgress),
      onClientFailure: (queueKey, _item, error) => {
        const message = store.failureMessage(error)
        // One alert per reason: a licence that refuses uploads fails every file in the batch.
        const alreadyReported = (queues.get(queueKey)?.items ?? []).some(
          (failedItem) => failedItem.status === UploadQueueItemStatus.Failed && failedItem.error.message === message
        )
        return {
          message,
          alert: () => {
            if (!alreadyReported) store.alert(message)
          },
        }
      },
      rowTracked: (queueKey, item) => store.rowTracked(queueKey, item),
      rowRemoved: (queueKey, item) => store.rowRemoved(queueKey, item),
      refreshable: false,
    },
  }
}

/** The run of an import: its request is all there is; `upload` and `stop` do nothing, never `finishAttempted`. */
export function adminDamImportRun(uploadInit: () => Promise<unknown>): UploadRun<'adminDam'> {
  return {
    [uploadSide]: 'adminDam',
    uploadInit,
    upload: () => Promise.resolve(),
    stop: () => {},
    finishAttempted: () => false,
  }
}
