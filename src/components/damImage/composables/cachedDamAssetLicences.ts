import type { IntegerId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import type { DamAssetLicence, DamAssetLicenceCached } from '@/types/coreDam/AssetLicence'
import { fetchDamAssetLicenceListByIds } from '@/components/dam/user/assetLicenceApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const mapFullToMinimal = (assetLicence: DamAssetLicence): DamAssetLicenceCached => ({
  id: assetLicence.id,
  name: assetLicence.name,
  badge: assetLicence.badge,
})

const mapIdToMinimal = (id: IntegerId): DamAssetLicenceCached => ({
  id: id,
  name: '',
  badge: '',
})

const { cache, toFetch, fetch, immediateFetch, add, addManual, has, get, isLoaded } = defineCached<
  IntegerId,
  DamAssetLicence,
  DamAssetLicenceCached
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { damClient } = useCommonAdminCoreDamOptions()

  return fetchDamAssetLicenceListByIds(damClient, ids)
})

export const useDamCachedAssetLicences = () => {
  return {
    addManualToCachedAssetLicences: addManual,
    addToCachedAssetLicences: add,
    fetchCachedAssetLicences: fetch,
    fetchCachedAssetLicencesImmediate: immediateFetch,
    toFetchCachedAssetLicences: toFetch,
    cachedAssetLicences: cache,
    hasCachedAssetLicence: has,
    getCachedAssetLicence: get,
    isLoadedCachedAssetLicence: isLoaded,
  }
}
