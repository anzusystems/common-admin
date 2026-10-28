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

// Author name cache per DAM configuration. It uses that configuration's
// client, address and ext system as they are at request time.
const defineCachedAuthors = (configName: string) =>
  defineCached<DocId, DamAuthor, DamAuthorMinimal>(mapFullToMinimal, mapIdToMinimal, (ids) => {
    const { cachedExtSystemId } = useExtSystemIdForCached(configName)
    const { damClient, endPointAuthor } = useCommonAdminCoreDamOptions(configName)
    return fetchAuthorListByIds(damClient, endPointAuthor, cachedExtSystemId.value, ids)
  })

// One cache per configuration name, created on first use. The `default` one is created with the module.
const caches = new Map([['default', defineCachedAuthors('default')]])
const cacheOf = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // Checked on every call: options set again (a test, a hot update) may have removed the name.
  checkDamConfigName(name)
  let cache = caches.get(name)
  if (!cache) {
    cache = defineCachedAuthors(name)
    caches.set(name, cache)
  }
  return cache
}

/**
 * Author name cache of the DAM configuration `configName`.
 * Without a name, uses the inherited one during component setup,
 * render or a lifecycle hook (not after an `await`), else `default`.
 * After the plugin sets options, an unknown configuration throws
 * on every call. Before that, the first request checks it.
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
