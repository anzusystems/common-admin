import type { DocId } from '@/shared/types/common'
import { defineCached } from '@/domains/cached/composables/defineCached'
import type { DamAuthor, DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { checkDamConfigName, inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

const mapFullToMinimal = (author: DamAuthor): DamAuthorMinimal => ({
  id: author.id,
  name: author.name,
  identifier: author.identifier,
  reviewed: author.flags.reviewed,
})

const mapIdToMinimal = (id: DocId): DamAuthorMinimal => {
  return { id: id, name: '', identifier: '', reviewed: false }
}

// The cache of the names of the authors of a DAM configuration: it asks with that configuration's client, at its
// address, under its ext system, as they are when it asks.
const defineCachedAuthors = (configName: string) =>
  defineCached<DocId, DamAuthor, DamAuthorMinimal>(mapFullToMinimal, mapIdToMinimal, (ids) => {
    const { cachedExtSystemId } = useExtSystemIdForCached(configName)
    const { damClient, endPointAuthor } = useCommonAdminCoreDamOptions(configName)
    return fetchAuthorListByIds(damClient, endPointAuthor, cachedExtSystemId.value, ids)
  })

// One cache per configuration name, made when the name is first asked for; that of `default` with the module.
const caches = new Map([['default', defineCachedAuthors('default')]])
const cacheOf = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // On every call: options set again (a test, a hot update) may have left the name out.
  checkDamConfigName(name)
  let cache = caches.get(name)
  if (!cache) {
    cache = defineCachedAuthors(name)
    caches.set(name, cache)
  }
  return cache
}

/**
 * The cache of the names of the authors of the DAM configuration `configName`.
 * A name left out is the inherited one while a component sets up, renders or runs a lifecycle hook (not after an
 * `await` there), else `default`. Once the plugin has set the options, a configuration the application has not got
 * throws on every call and gets no cache; a name asked for before that gets one, and its first request checks it.
 */
export const useDamCachedAuthors = (configName?: string) => {
  const { cache, toFetch, fetch, add, addManual, addManualMinimal, pin, unpin, has, get, isLoaded } =
    cacheOf(configName)
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

export const useDamCachedAuthorsForRemoteAutocomplete = (configName: string) => {
  const { fetch, add, addManualMinimal } = cacheOf(configName)
  return {
    fetch,
    add,
    addManualMinimal,
  }
}
