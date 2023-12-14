import type { DocId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import type { DamKeyword, DamKeywordMinimal } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import { fetchKeywordListByIds } from '@/components/damImage/uploadQueue/api/keywordApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

const mapFullToMinimal = (keyword: DamKeyword): DamKeywordMinimal => ({
  id: keyword.id,
  name: keyword.name,
})

const mapIdToMinimal = (id: DocId): DamKeywordMinimal => {
  return { id: id, name: '' }
}

const { cache, toFetch, fetch, add, addManual, addManualMinimal, has, get, isLoaded } = defineCached<
  DocId,
  DamKeyword,
  DamKeywordMinimal
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { cachedExtSystemId } = useExtSystemIdForCached()
  const { damClient } = useCommonAdminCoreDamOptions()
  return fetchKeywordListByIds(damClient, cachedExtSystemId.value, ids)
})

export const useDamCachedKeywords = () => {
  return {
    addManualToCachedKeywords: addManual,
    addManualMinimalToCachedKeywords: addManualMinimal,
    addToCachedKeywords: add,
    fetchCachedKeywords: fetch,
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
