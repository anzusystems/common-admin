import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { DamAssetType } from '@/types/coreDam/Asset'
import { isUndefined } from '@/utils/common'

export function useUploadQueueMassOperations(queueKey: UploadQueueKey) {
  const uploadQueuesStore = useUploadQueuesStore()

  const replaceEmptyCustomDataValue = (
    data: { assetType: DamAssetType; elementProperty: string; value: any },
    forceReplace = false
  ) => {
    const items = uploadQueuesStore.getQueueItems(queueKey)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.assetType !== data.assetType) continue
      if (
        forceReplace ||
        isUndefined(item.customData[data.elementProperty]) ||
        item.customData[data.elementProperty] === ''
      ) {
        item.customData[data.elementProperty] = data.value
      }
    }
  }

  const replaceEmptyKeywords = (value: any, forceReplace = false) => {
    const items = uploadQueuesStore.getQueueItems(queueKey)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.keywords) || item.keywords.length === 0) {
        item.keywords = value
      }
    }
  }

  const replaceEmptyAuthors = (value: any, forceReplace = false) => {
    const items = uploadQueuesStore.getQueueItems(queueKey)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
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
