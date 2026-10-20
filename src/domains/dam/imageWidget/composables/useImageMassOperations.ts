import { isUndefined } from '@/shared/utils/common'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { DocId, IntegerId } from '@/shared/types/common'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'

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
  const damConfigStore = useDamConfigStore()

  const replaceEmptyAuthors = async (value: DocId[], forceReplace = false) => {
    if (imageStore.readonly) return
    // No authors picked fill nothing: written all the same, they would only take the source of the rows away.
    if (!forceReplace && value.length === 0) return
    // Their names under the ext system of the licence of the asset of each row, as every name of the authors of the
    // DAM the widgets write, and under that of the page where the page does not know the licence (not read for it):
    // one lookup per ext system. The page's went for every row.
    const pageExtSystem = cachedExtSystemId.value
    const extSystemOf = new Map<IntegerId, IntegerId>()
    imageStore.images.forEach((item) => {
      const licence = item.dam.licenceId
      extSystemOf.set(licence, damConfigStore.damConfigLicenceExtSystem.get(licence)?.extSystem ?? pageExtSystem)
    })
    const namesUnder = new Map<IntegerId, string>()
    await Promise.all(
      [...new Set([...extSystemOf.values(), pageExtSystem])].map(async (extSystem) => {
        const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, [...value])
        const authorNames: string[] = []
        value.forEach((authorId) => {
          const name = authorsRes.find((author) => author.id === authorId)?.name
          if (!isUndefined(name) && name.trim().length > 0) authorNames.push(name)
        })
        namesUnder.set(extSystem, authorNames.join(', '))
      })
    )
    // The widget may have turned read-only while the authors loaded.
    if (imageStore.readonly) return
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
        item.texts.source = namesUnder.get(extSystemOf.get(item.dam.licenceId) ?? pageExtSystem) ?? ''
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
