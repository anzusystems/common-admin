import type { IntegerId } from '@/shared/types/common'
import type { DamAssetLicenceCached, DamAssetLicenceExtended } from '@/domains/dam/types/AssetLicence'
import { defineCached } from '@/domains/cached/composables/defineCached'
import { fetchDamAssetLicenceListByIds } from '@/domains/dam/user/api/assetLicenceApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { checkDamConfigName, inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

const mapFullToMinimal = (assetLicence: DamAssetLicenceExtended): DamAssetLicenceCached => ({
  id: assetLicence.id,
  name: assetLicence.name,
  // A DAM without licence badges sends none.
  badge: assetLicence.badge ?? '',
})

const mapIdToMinimal = (id: IntegerId): DamAssetLicenceCached => ({
  id: id,
  name: '',
  badge: '',
})

// Licence cache per DAM configuration. It uses that configuration's client and `endPointAssetLicence`.
const defineCachedAssetLicences = (configName: string) =>
  defineCached<IntegerId, DamAssetLicenceExtended, DamAssetLicenceCached>(
    mapFullToMinimal,
    mapIdToMinimal,
    (ids) => {
      const { damClient, endPointAssetLicence } = useCommonAdminCoreDamOptions(configName)
      return fetchDamAssetLicenceListByIds(damClient, ids, endPointAssetLicence) as Promise<DamAssetLicenceExtended[]>
    },
    'id',
    1000,
    // A licence missing from the answer is not requested again on every tile or detail that shows it.
    { retryNotFound: false }
  )

// One cache per configuration name, created on first use. The `default` one is created with the module.
const caches = new Map([['default', defineCachedAssetLicences('default')]])

/**
 * Licence cache of the DAM configuration `configName`.
 * Without a name, uses the inherited one during component setup,
 * render or a lifecycle hook (not after an `await`), else `default`.
 * After the plugin sets options, an unknown configuration throws
 * on every call. Before that, the first request checks it.
 */
export const useDamCachedAssetLicences = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // Checked on every call: options set again (a test, a hot update) may have removed the name.
  checkDamConfigName(name)
  let named = caches.get(name)
  if (!named) {
    named = defineCachedAssetLicences(name)
    caches.set(name, named)
  }
  const { cache, fetch, add, addManual, has, get, isLoaded } = named
  return {
    addManualToCachedAssetLicences: addManual,
    addToCachedAssetLicences: add,
    fetchCachedAssetLicences: fetch,
    cachedAssetLicences: cache,
    hasCachedAssetLicence: has,
    getCachedAssetLicence: get,
    isLoadedCachedAssetLicence: isLoaded,
  }
}
