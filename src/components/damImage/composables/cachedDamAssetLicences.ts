import type { IntegerId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import type { DamAssetLicenceCached, DamAssetLicenceExtended } from '@/types/coreDam/AssetLicence'
import { fetchDamAssetLicenceListByIds } from '@/components/dam/user/assetLicenceApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const mapFullToMinimal = (assetLicence: DamAssetLicenceExtended): DamAssetLicenceCached => ({
  id: assetLicence.id,
  name: assetLicence.name,
  badge: assetLicence.badge ?? '',
  flags: assetLicence.flags,
  autoDelete: assetLicence.autoDelete,
})

const mapIdToMinimal = (id: IntegerId): DamAssetLicenceCached => ({
  id: id,
  name: '',
  badge: '',
  flags: { manualUploadAllowed: false, directUseAllowed: true, singleUseEnforced: false },
  autoDelete: { active: false, olderThanDays: 0 },
})

const { cache, toFetch, fetch, add, addManual, has, get, isLoaded } = defineCached<
  IntegerId,
  DamAssetLicenceExtended,
  DamAssetLicenceCached
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { damClient } = useCommonAdminCoreDamOptions()

  return fetchDamAssetLicenceListByIds(damClient, ids) as Promise<DamAssetLicenceExtended[]>
})

export const useDamCachedAssetLicences = () => {
  return {
    addManualToCachedAssetLicences: addManual,
    addToCachedAssetLicences: add,
    fetchCachedAssetLicences: fetch,
    toFetchCachedAssetLicences: toFetch,
    cachedAssetLicences: cache,
    hasCachedAssetLicence: has,
    getCachedAssetLicence: get,
    isLoadedCachedAssetLicence: isLoaded,
  }
}
