import { type InjectionKey, type MaybeRefOrGetter, toValue } from 'vue'
import type { DocId } from '@/shared/types/common'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { CustomDataValue } from '@/domains/customDataForm/types/CustomDataForm'
import type { UploadQueue, UploadQueueItem, UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { UploadRefreshOutcome } from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import type { UploadRefreshWarningKey } from '@/domains/dam/uploadQueue/composables/uploadQueueItemRefresh'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useUploadQueueMassOperations } from '@/domains/dam/uploadQueue/composables/uploadQueueMassOperations'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useAlerts } from '@/domains/system/composables/alerts'

/**
 * How a row's keywords and authors look while not editable: as chips, or as a disabled input.
 */
export type DamFieldsDisabledAs = 'chips' | 'input'

/**
 * The suggestions of a queue. Name chips of its rows mark them as "new".
 */
export type UploadQueueSuggestionsLookup = (queueKey: UploadQueueKey) => UploadQueue['suggestions'] | undefined

/**
 * Provided by an application whose queues are not in the library store. Without it the chips read that store.
 */
export const UploadQueueSuggestionsKey: InjectionKey<UploadQueueSuggestionsLookup> =
  Symbol.for('anzu:UploadQueueSuggestions')

/**
 * Default: the suggestions in the library store. The store is resolved only when a chip needs them.
 */
export const libraryUploadQueueSuggestions: UploadQueueSuggestionsLookup = (queueKey) =>
  useUploadQueuesStore().getQueue(queueKey)?.suggestions

/**
 * What a queue list needs from its host. Without it the list uses the library store.
 */
export interface UploadQueueListBinding {
  items(): UploadQueueItem[]
  /**
   * `queueKey` is the one from the row's event.
   */
  cancel(item: UploadQueueItem, index: number, queueKey: UploadQueueKey): void
  /**
   * Used by the library's default "remove from queue".
   */
  remove(index: number): void
  refresh(item: UploadQueueItem): Promise<UploadRefreshOutcome>
  refreshMayHelp(item: UploadQueueItem): boolean
  /**
   * Shows a refresh warning through the host's own alerts.
   */
  warn(key: UploadRefreshWarningKey): void
  /**
   * Passes the rows' keywords and authors to the name caches and fetches them, once when the list mounts.
   */
  prime(items: UploadQueueItem[]): void
  mainFileSingleUseEnabled: boolean
}

/**
 * Default list binding: the library store, caches, alerts and options. It follows the key as it changes.
 */
export function useLibraryUploadQueueListBinding(
  queueKey: MaybeRefOrGetter<UploadQueueKey>,
  configName: string
): UploadQueueListBinding {
  const uploadQueuesStore = useUploadQueuesStore()
  const { showWarningT } = useAlerts()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords(configName)
  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors(configName)
  const { mainFileSingleUseEnabled } = useCommonAdminCoreDamOptions(configName)

  return {
    items: () => uploadQueuesStore.getQueueItems(toValue(queueKey)),
    cancel: (item, index, itemQueueKey) => uploadQueuesStore.stopItemUpload(itemQueueKey, item, index),
    remove: (index) => uploadQueuesStore.removeByIndex(toValue(queueKey), index),
    // A row offers refresh only with its asset. Rows of its queue's configuration are settled by the refresh.
    refresh: (item) => uploadQueuesStore.refreshAsset(item.assetId!, { queueKey: toValue(queueKey) }),
    refreshMayHelp: (item) => uploadQueuesStore.refreshMayHelp(item),
    warn: (key) => showWarningT(key),
    prime: (items) => {
      items.forEach((item) => {
        addToCachedKeywords(item.keywords)
        addToCachedAuthors(item.authors)
      })
      fetchCachedKeywords()
      fetchCachedAuthors()
    },
    mainFileSingleUseEnabled,
  }
}

/**
 * What a queue's mass operations need from their host. Without it they use the library store.
 */
export interface UploadQueueMassOperationsBinding {
  assetTypes(): DamAssetTypeType[]
  fillCustomDataValue(
    data: { assetType: DamAssetTypeType; elementProperty: string; value: CustomDataValue },
    forceReplace?: boolean
  ): void
  /**
   * The host decides which rows are filled. The library fills every row.
   */
  fillKeywords(value: DocId[], forceReplace?: boolean): void
  fillAuthors(value: DocId[], forceReplace?: boolean): void
}

/**
 * Default binding: the asset types of the library store and `useUploadQueueMassOperations`.
 */
export function useLibraryUploadQueueMassOperationsBinding(
  queueKey: MaybeRefOrGetter<UploadQueueKey>
): UploadQueueMassOperationsBinding {
  const uploadQueuesStore = useUploadQueuesStore()
  const { replaceEmptyCustomDataValue, replaceEmptyKeywords, replaceEmptyAuthors } =
    useUploadQueueMassOperations(queueKey)

  return {
    assetTypes: () => uploadQueuesStore.getQueueItemsTypes(toValue(queueKey)),
    fillCustomDataValue: replaceEmptyCustomDataValue,
    fillKeywords: replaceEmptyKeywords,
    fillAuthors: replaceEmptyAuthors,
  }
}
