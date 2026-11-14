import { isUndefined } from '@/utils/common'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import type { DocId } from '@/types/common'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import {
  damCreditFromMap,
  getDamCreditConfig,
} from '@/components/damImage/uploadQueue/composables/damCredit'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

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

  const { damClient } = useCommonAdminCoreDamOptions()
  const { cachedExtSystemId } = useExtSystemIdForCached()

  const loadAuthorsMap = async (ids: DocId[]) => {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return new Map<DocId, DamAuthor>()
    const res = await fetchAuthorListByIds(damClient, cachedExtSystemId.value, unique)
    return new Map(res.map((author) => [author.id, author]))
  }

  const replaceEmptyAuthors = async (value: DocId[], forceReplace = false) => {
    const items = imageStore.images
    const authorsMap = await loadAuthorsMap([...value, ...items.flatMap((item) => item.damSources)])
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.damAuthors) || item.damAuthors.length === 0) {
        item.damAuthors = value
        item.damSelectionChanged = true
        item.texts.source = damCreditFromMap(
          authorsMap,
          item.damSources,
          value,
          getDamCreditConfig(cachedExtSystemId.value),
        )
      }
    }
  }

  const replaceEmptySources = async (value: DocId[], forceReplace = false) => {
    const items = imageStore.images
    const authorsMap = await loadAuthorsMap([...value, ...items.flatMap((item) => item.damAuthors)])
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.damSources) || item.damSources.length === 0) {
        item.damSources = value
        item.damSelectionChanged = true
        item.texts.source = damCreditFromMap(
          authorsMap,
          value,
          item.damAuthors,
          getDamCreditConfig(cachedExtSystemId.value),
        )
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
