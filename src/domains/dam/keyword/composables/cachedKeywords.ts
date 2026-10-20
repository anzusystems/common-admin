import type { DocId } from '@/shared/types/common'
import { defineCached } from '@/domains/cached/composables/defineCached'
import type { DamKeyword, DamKeywordMinimal } from '@/domains/dam/keyword/types/DamKeyword'
import { fetchKeywordListByIds } from '@/domains/dam/keyword/api/keywordApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { checkDamConfigName, inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

const mapFullToMinimal = (keyword: DamKeyword): DamKeywordMinimal => ({
  id: keyword.id,
  name: keyword.name,
})

const mapIdToMinimal = (id: DocId): DamKeywordMinimal => {
  return { id: id, name: '' }
}

// The cache of the names of the keywords of a DAM configuration: it asks with that configuration's client, at its
// address, under its ext system, as they are when it asks.
const defineCachedKeywords = (configName: string) =>
  defineCached<DocId, DamKeyword, DamKeywordMinimal>(mapFullToMinimal, mapIdToMinimal, (ids) => {
    const { cachedExtSystemId } = useExtSystemIdForCached(configName)
    const { damClient, endPointKeyword } = useCommonAdminCoreDamOptions(configName)
    return fetchKeywordListByIds(damClient, endPointKeyword, cachedExtSystemId.value, ids)
  })

// One cache per configuration name, made when the name is first asked for; that of `default` with the module.
const caches = new Map([['default', defineCachedKeywords('default')]])
const cacheOf = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // On every call: options set again (a test, a hot update) may have left the name out.
  checkDamConfigName(name)
  let cache = caches.get(name)
  if (!cache) {
    cache = defineCachedKeywords(name)
    caches.set(name, cache)
  }
  return cache
}

/**
 * The cache of the names of the keywords of the DAM configuration `configName`.
 * A name left out is the inherited one while a component sets up, renders or runs a lifecycle hook (not after an
 * `await` there), else `default`. Once the plugin has set the options, a configuration the application has not got
 * throws on every call and gets no cache; a name asked for before that gets one, and its first request checks it.
 */
export const useDamCachedKeywords = (configName?: string) => {
  const { cache, toFetch, fetch, add, addManual, addManualMinimal, pin, unpin, has, get, isLoaded } =
    cacheOf(configName)
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

export const useCachedKeywordsForRemoteAutocomplete = (configName: string) => {
  const { fetch, add, addManualMinimal } = cacheOf(configName)
  return {
    fetch,
    add,
    addManualMinimal,
  }
}
