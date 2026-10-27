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

// Keyword name cache per DAM configuration, using that configuration's client, endpoint and ext system.
const defineCachedKeywords = (configName: string) =>
  defineCached<DocId, DamKeyword, DamKeywordMinimal>(mapFullToMinimal, mapIdToMinimal, (ids) => {
    const { cachedExtSystemId } = useExtSystemIdForCached(configName)
    const { damClient, endPointKeyword } = useCommonAdminCoreDamOptions(configName)
    return fetchKeywordListByIds(damClient, endPointKeyword, cachedExtSystemId.value, ids)
  })

// One cache per configuration name, created on first use. The `default` one is created with the module.
const caches = new Map([['default', defineCachedKeywords('default')]])
const cacheOf = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // Checked on every call: options set again (a test, a hot update) may have removed the name.
  checkDamConfigName(name)
  let cache = caches.get(name)
  if (!cache) {
    cache = defineCachedKeywords(name)
    caches.set(name, cache)
  }
  return cache
}

/**
 * The keyword name cache of the DAM configuration `configName`.
 * Without a name, the inherited one is used during setup, render
 * or a lifecycle hook (not after an `await`), else `default`.
 * After the plugin sets the options, an unknown configuration throws on every call and gets no cache.
 * A name asked for before that gets a cache, and its first request checks the name.
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
