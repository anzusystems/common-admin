import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { isArray, isNull, isUndefined } from '@/shared/utils/common'

export function useUploadQueueMassOperations(queueKey: UploadQueueKey) {
  const uploadQueuesStore = useUploadQueuesStore()

  const replaceEmptyCustomDataValue = (
    data: { assetType: DamAssetTypeType; elementProperty: string; value: any },
    forceReplace = false
  ) => {
    const items = uploadQueuesStore.getQueueItems(queueKey)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (item.assetType !== data.assetType) continue
      const current = item.customData[data.elementProperty]
      // `null` is how a value saved empty comes back; a field of several values is empty as an empty list.
      const empty = isUndefined(current) || isNull(current) || current === '' || (isArray(current) && !current.length)
      if (forceReplace || empty) {
        item.customData[data.elementProperty] = data.value
      }
    }
  }

  const replaceEmptyKeywords = (value: any, forceReplace = false) => {
    const items = uploadQueuesStore.getQueueItems(queueKey)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.keywords) || item.keywords.length === 0) {
        item.keywords = value
      }
    }
  }

  const replaceEmptyAuthors = (value: any, forceReplace = false) => {
    const items = uploadQueuesStore.getQueueItems(queueKey)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.authors) || item.authors.length === 0) {
        item.authors = value
      }
    }
  }

  return {
    replaceEmptyCustomDataValue,
    replaceEmptyKeywords,
    replaceEmptyAuthors,
  }
}
