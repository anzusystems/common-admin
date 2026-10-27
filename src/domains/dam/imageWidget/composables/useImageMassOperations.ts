import { isUndefined } from '@/shared/utils/common'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { DocId, IntegerId } from '@/shared/types/common'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'

export function useImageMassOperations(configName: string) {
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
        // The source is user-given text, not names from an author pick.
        imageStore.forgetSourceOfPick(item)
      }
    }
  }

  const { damClient, endPointAuthor } = useCommonAdminCoreDamOptions(configName)
  const { cachedExtSystemId } = useExtSystemIdForCached(configName)
  const damConfigStore = useDamConfigStoreOf(configName)

  const replaceEmptyAuthors = async (value: DocId[], forceReplace = false) => {
    if (imageStore.readonly) return
    // Empty picks fill nothing. Writing them would only clear the rows' sources.
    if (!forceReplace && value.length === 0) return
    // Names under the ext system of each row's asset licence, as everywhere else in the widgets.
    // Falls back to the configured ext system when the licence is unknown. One
    // lookup per ext system; the fallback was previously used for every row.
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
      // Whitespace counts as empty, as in the required-source check.
      const noSource = isUndefined(item.texts.source) || item.texts.source.trim().length === 0
      // A row not offering the authors shows its source. A filled source is the user's and is not overwritten.
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
