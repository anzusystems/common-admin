import type { DocId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import type { DamKeyword, DamKeywordMinimal } from '@/components/damImage/uploadQueue/keywords/DamKeyword'
import { fetchKeywordListByIds } from '@/components/damImage/uploadQueue/api/keywordApi'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { isNull } from '@/utils/common'

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
  const { initialized } = useDamConfigState()
  if (isNull(initialized.damConfigExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }
  const { damClient } = useCommonAdminCoreDamOptions()
  return fetchKeywordListByIds(damClient, initialized.damConfigExtSystem, ids)
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
