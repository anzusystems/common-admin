import { isUndefined } from '@/shared/utils/common'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { DocId } from '@/shared/types/common'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'

export function useImageMassOperations() {
  const imageStore = useImageStore()

  const replaceEmptyDescription = (value: string, forceReplace = false) => {
    if (imageStore.readonly) return
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.texts.description) || item.texts.description.length === 0) {
        item.texts.description = value
      }
    }
  }

  const replaceEmptySource = (value: string, forceReplace = false) => {
    if (imageStore.readonly) return
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.texts.source) || item.texts.source.length === 0) {
        item.texts.source = value
      }
    }
  }

  const { damClient } = useCommonAdminCoreDamOptions()
  const { cachedExtSystemId } = useExtSystemIdForCached()

  const replaceEmptyAuthors = async (value: DocId[], forceReplace = false) => {
    if (imageStore.readonly) return
    const authorsMap = new Map<DocId, string>()
    const authorNames: string[] = []
    const authorsRes = await fetchAuthorListByIds(damClient, cachedExtSystemId.value, [...value])
    // The widget may have turned read-only while the authors loaded.
    if (imageStore.readonly) return
    authorsRes.forEach((author) => {
      authorsMap.set(author.id, author.name)
    })
    value.forEach((authorId) => {
      const name = authorsMap.get(authorId)
      if (!isUndefined(name) && name.trim().length > 0) {
        authorNames.push(name)
      }
    })
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      if (forceReplace || isUndefined(item.damAuthors) || item.damAuthors.length === 0) {
        item.damAuthors = value
        item.texts.source = authorNames.join(', ')
      }
    }
  }

  return {
    replaceEmptyDescription,
    replaceEmptySource,
    replaceEmptyAuthors,
  }
}
