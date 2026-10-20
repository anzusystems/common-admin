import type { DocId } from '@/shared/types/common'
import { defineCached } from '@/domains/cached/composables/defineCached'
import type { DamKeyword, DamKeywordMinimal } from '@/domains/dam/keyword/types/DamKeyword'
import { fetchKeywordListByIds } from '@/domains/dam/keyword/api/keywordApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'

const mapFullToMinimal = (keyword: DamKeyword): DamKeywordMinimal => ({
  id: keyword.id,
  name: keyword.name,
})

const mapIdToMinimal = (id: DocId): DamKeywordMinimal => {
  return { id: id, name: '' }
}

const { cache, toFetch, fetch, add, addManual, addManualMinimal, pin, unpin, has, get, isLoaded } = defineCached<
  DocId,
  DamKeyword,
  DamKeywordMinimal
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { cachedExtSystemId } = useExtSystemIdForCached()
  // One cache for the page, which no component hands a configuration: it asks as the default one says.
  const { damClient, endPointKeyword } = useCommonAdminCoreDamOptions()
  return fetchKeywordListByIds(damClient, endPointKeyword, cachedExtSystemId.value, ids)
})

export const useDamCachedKeywords = () => {
  return {
    addManualToCachedKeywords: addManual,
    addManualMinimalToCachedKeywords: addManualMinimal,
    addToCachedKeywords: add,
    fetchCachedKeywords: fetch,
    pinCachedKeyword: pin,
    unpinCachedKeyword: unpin,
    toFetchCachedKeywords: toFetch,
    cachedKeywords: cache,
    hasCachedKeyword: has,
    getCachedKeyword: get,
    isLoadedCachedKeyword: isLoaded,
  }
}

export const useCachedKeywordsForRemoteAutocomplete = () => {
  return {
    fetch,
    add,
    addManualMinimal,
  }
}
