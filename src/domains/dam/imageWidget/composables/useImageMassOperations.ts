import { isUndefined } from '@/shared/utils/common'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { DocId } from '@/shared/types/common'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'

export function useImageMassOperations(configName?: string) {
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
        // A text the user gives, not the names of a pick of authors.
        imageStore.forgetSourceOfPick(item)
      }
    }
  }

  const { damClient, endPointAuthor } = useCommonAdminCoreDamOptions(configName)
  const { cachedExtSystemId } = useExtSystemIdForCached()

  const replaceEmptyAuthors = async (value: DocId[], forceReplace = false) => {
    if (imageStore.readonly) return
    // No authors picked fill nothing: written all the same, they would only take the source of the rows away.
    if (!forceReplace && value.length === 0) return
    const authorsMap = new Map<DocId, string>()
    const authorNames: string[] = []
    const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, cachedExtSystemId.value, [...value])
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
      const noAuthors = isUndefined(item.damAuthors) || item.damAuthors.length === 0
      // Of white space alone it is empty too, as the check of a required source takes it.
      const noSource = isUndefined(item.texts.source) || item.texts.source.trim().length === 0
      // A row that does not offer the authors shows its source: filled in, that source is the user's, and the names
      // of the picked authors are not written over it.
      if (forceReplace || (noAuthors && (item.showDamAuthors || noSource))) {
        item.damAuthors = value
        item.texts.source = authorNames.join(', ')
        imageStore.noteSourceOfPick(item)
      }
    }
  }

  return {
    replaceEmptyDescription,
    replaceEmptySource,
    replaceEmptyAuthors,
  }
}
