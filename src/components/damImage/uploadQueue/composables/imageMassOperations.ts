import { isUndefined } from '@/utils/common'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'

export function useImageMassOperations() {
  const imageStore = useImageStore()

  const replaceEmptyDescription = (value: any, forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.texts.description) || item.texts.description.length === 0) {
        item.texts.description = value
      }
    }
  }

  const replaceEmptySource = (value: any, forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.texts.source) || item.texts.source.length === 0) {
        item.texts.source = value
      }
    }
  }

  return {
    replaceEmptyDescription,
    replaceEmptySource,
  }
}
