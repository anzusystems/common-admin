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

/** How the keywords and authors of a row look while they cannot be edited: their chips, or a switched-off input. */
export type DamFieldsDisabledAs = 'chips' | 'input'

/** The suggestions of a queue, which the name chips of its rows mark as "new". */
export type UploadQueueSuggestionsLookup = (queueKey: UploadQueueKey) => UploadQueue['suggestions'] | undefined

/** Provided by an application whose queues are not the library's store. Without it the chips read that store. */
export const UploadQueueSuggestionsKey: InjectionKey<UploadQueueSuggestionsLookup> =
  Symbol.for('anzu:UploadQueueSuggestions')

/** Today's library: the suggestions in its store, which is asked for only when a chip needs them. */
export const libraryUploadQueueSuggestions: UploadQueueSuggestionsLookup = (queueKey) =>
  useUploadQueuesStore().getQueue(queueKey)?.suggestions

/** What the list of a queue asks of its host. Without it the list works over the library's store, as today. */
export interface UploadQueueListBinding {
  items(): UploadQueueItem[]
  /** `queueKey` is the one in the row's event. */
  cancel(item: UploadQueueItem, index: number, queueKey: UploadQueueKey): void
  /** For the library's default "remove from queue". */
  remove(index: number): void
  refresh(item: UploadQueueItem): Promise<UploadRefreshOutcome>
  refreshMayHelp(item: UploadQueueItem): boolean
  /** A warning of a refresh, through the host's own alerts. */
  warn(key: UploadRefreshWarningKey): void
  /** Hands the keywords and authors of the rows to the name caches and asks for them, once when the list mounts. */
  prime(items: UploadQueueItem[]): void
  mainFileSingleUseEnabled: boolean
}

/** Today's list of the library: its store, its caches, its alerts, its options. It follows the key as it changes. */
export function useLibraryUploadQueueListBinding(
  queueKey: MaybeRefOrGetter<UploadQueueKey>,
  configName: string
): UploadQueueListBinding {
  const uploadQueuesStore = useUploadQueuesStore()
  const { showWarningT } = useAlerts()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
  const { mainFileSingleUseEnabled } = useCommonAdminCoreDamOptions(configName)

  return {
    items: () => uploadQueuesStore.getQueueItems(toValue(queueKey)),
    cancel: (item, index, itemQueueKey) => uploadQueuesStore.stopItemUpload(itemQueueKey, item, index),
    remove: (index) => uploadQueuesStore.removeByIndex(toValue(queueKey), index),
    // A row offers refresh only with its asset.
    refresh: (item) => uploadQueuesStore.refreshAsset(item.assetId!),
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

/** What the mass operations of a queue ask of their host. Without it they work over the library's store. */
export interface UploadQueueMassOperationsBinding {
  assetTypes(): DamAssetTypeType[]
  fillCustomDataValue(
    data: { assetType: DamAssetTypeType; elementProperty: string; value: CustomDataValue },
    forceReplace?: boolean
  ): void
  /** Into which rows is the host's: every row in the library. */
  fillKeywords(value: DocId[], forceReplace?: boolean): void
  fillAuthors(value: DocId[], forceReplace?: boolean): void
}

/** Today's: the asset types of the library's store and `useUploadQueueMassOperations`. */
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
