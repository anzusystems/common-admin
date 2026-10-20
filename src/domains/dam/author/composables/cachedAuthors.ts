import type { DocId } from '@/shared/types/common'
import { defineCached } from '@/domains/cached/composables/defineCached'
import type { DamAuthor, DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'

const mapFullToMinimal = (author: DamAuthor): DamAuthorMinimal => ({
  id: author.id,
  name: author.name,
  identifier: author.identifier,
  reviewed: author.flags.reviewed,
})

const mapIdToMinimal = (id: DocId): DamAuthorMinimal => {
  return { id: id, name: '', identifier: '', reviewed: false }
}

const { cache, toFetch, fetch, add, addManual, addManualMinimal, pin, unpin, has, get, isLoaded } = defineCached<
  DocId,
  DamAuthor,
  DamAuthorMinimal
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { cachedExtSystemId } = useExtSystemIdForCached()
  // One cache for the page, which no component hands a configuration: it asks as the default one says.
  const { damClient, endPointAuthor } = useCommonAdminCoreDamOptions()
  return fetchAuthorListByIds(damClient, endPointAuthor, cachedExtSystemId.value, ids)
})

export const useDamCachedAuthors = () => {
  return {
    addManualToCachedAuthors: addManual,
    addManualMinimalToCachedAuthors: addManualMinimal,
    addToCachedAuthors: add,
    fetchCachedAuthors: fetch,
    pinCachedAuthor: pin,
    unpinCachedAuthor: unpin,
    toFetchCachedAuthors: toFetch,
    cachedAuthors: cache,
    hasCachedAuthor: has,
    getCachedAuthor: get,
    isLoadedCachedAuthor: isLoaded,
  }
}

export const useDamCachedAuthorsForRemoteAutocomplete = () => {
  return {
    fetch,
    add,
    addManualMinimal,
  }
}
