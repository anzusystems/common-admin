import { type MaybeRefOrGetter, toValue } from 'vue'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { fillAuthors, fillCustomDataValue, fillKeywords } from '@/domains/dam/uploadQueue/core/uploadQueueFill'

export function useUploadQueueMassOperations(queueKey: MaybeRefOrGetter<UploadQueueKey>) {
  const uploadQueuesStore = useUploadQueuesStore()

  const replaceEmptyCustomDataValue = (
    data: { assetType: DamAssetTypeType; elementProperty: string; value: any },
    forceReplace = false
  ) => {
    fillCustomDataValue(uploadQueuesStore.getQueueItems(toValue(queueKey)), data, forceReplace)
  }

  const replaceEmptyKeywords = (value: any, forceReplace = false) => {
    fillKeywords(uploadQueuesStore.getQueueItems(toValue(queueKey)), value, forceReplace)
  }

  const replaceEmptyAuthors = (value: any, forceReplace = false) => {
    fillAuthors(uploadQueuesStore.getQueueItems(toValue(queueKey)), value, forceReplace)
  }

  return {
    replaceEmptyCustomDataValue,
    replaceEmptyKeywords,
    replaceEmptyAuthors,
  }
}
