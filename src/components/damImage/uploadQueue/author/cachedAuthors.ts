import type { DocId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import type { DamAuthor, DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

const mapFullToMinimal = (author: DamAuthor): DamAuthorMinimal => ({
  id: author.id,
  name: author.name,
  identifier: author.identifier,
  reviewed: author.flags.reviewed,
})

const mapIdToMinimal = (id: DocId): DamAuthorMinimal => {
  return { id: id, name: '', identifier: '', reviewed: false }
}

const { cache, toFetch, fetch, add, addManual, addManualMinimal, has, get, isLoaded } = defineCached<
  DocId,
  DamAuthor,
  DamAuthorMinimal
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { cachedExtSystemId } = useExtSystemIdForCached()
  const { damClient } = useCommonAdminCoreDamOptions()
  return fetchAuthorListByIds(damClient, cachedExtSystemId.value, ids)
})

export const useDamCachedAuthors = () => {
  return {
    addManualToCachedAuthors: addManual,
    addManualMinimalToCachedAuthors: addManualMinimal,
    addToCachedAuthors: add,
    fetchCachedAuthors: fetch,
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
