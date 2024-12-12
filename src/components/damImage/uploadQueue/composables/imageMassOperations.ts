import { isUndefined } from '@/utils/common'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import type { DocId } from '@/types/common'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

export function useImageMassOperations() {
  const imageStore = useImageStore()

  const replaceEmptyDescription = (value: string, forceReplace = false) => {
    const items = imageStore.images
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (forceReplace || isUndefined(item.texts.description) || item.texts.description.length === 0) {
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

  const replaceEmptyAuthors = async (value: DocId[], forceReplace = false) => {
    const authorsMap = new Map<DocId, string>()
    const authorNames: string[] = []
    const authorsRes = await fetchAuthorListByIds(damClient, cachedExtSystemId.value, [
      ...value,
    ])
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
      const item = items[i]
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
