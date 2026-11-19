import { isUndefined } from '@/utils/common'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import type { DocId } from '@/types/common'

export function useImageMassOperations() {
  const imageStore = useImageStore()

  const replaceEmptyDescription = (value: string, forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (
        forceReplace ||
        isUndefined(item.texts.description) ||
        item.texts.description.length === 0
      ) {
        item.texts.description = value
      }
    }
  }

  const replaceEmptySource = (value: string, forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.texts.source) || item.texts.source.length === 0) {
        item.texts.source = value
      }
    }
  }

  const replaceEmptyAuthors = (value: DocId[], forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.showDamAuthors && (forceReplace || isUndefined(item.damAuthors) || item.damAuthors.length === 0)) {
        item.damAuthors = value
        item.damSelectionChanged = true
      }
    }
  }

  const replaceEmptySources = (value: DocId[], forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.showDamAuthors && (forceReplace || isUndefined(item.damSources) || item.damSources.length === 0)) {
        item.damSources = value
        item.damSelectionChanged = true
      }
    }
  }

  return {
    replaceEmptyDescription,
    replaceEmptySource,
    replaceEmptyAuthors,
    replaceEmptySources,
  }
}
