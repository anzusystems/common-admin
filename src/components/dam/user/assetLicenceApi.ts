import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
// eslint-disable-next-line anzu/no-deprecated-imports
import { apiFetchList } from '@/services/api/apiFetchList'
import type { Pagination } from '@/types/Pagination'
// eslint-disable-next-line anzu/no-deprecated-imports
import type { FilterBag } from '@/types/Filter'

const END_POINT = '/adm/v1/asset-licence'
export const ENTITY = 'assetLicence'

export const fetchDamAssetLicenceListByIds = (client: () => AxiosInstance, ids: IntegerId[]) => {
  const { executeFetch } = useApiFetchByIds<DamAssetLicence[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return executeFetch(ids)
}

export const useFetchDamAssetLicenceList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetLicence[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

/**
 * @deprecated
 */
export const fetchDamAssetLicenceList = (client: () => AxiosInstance, pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<DamAssetLicence[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)
