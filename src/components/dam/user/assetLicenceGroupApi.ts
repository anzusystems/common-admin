import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { IntegerId } from '@/types/common'
import type { DamAssetLicenceGroup } from '@/types/coreDam/AssetLicenceGroup'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
// import type { Pagination } from '@/types/Pagination'
// import type { FilterBag } from '@/types/Filter'
// import { apiFetchList } from '@/services/api/apiFetchList'

const END_POINT = '/adm/v1/asset-licence-group'
export const ENTITY = 'assetLicenceGroup'

export const fetchDamAssetLicenceGroupListByIds = (client: () => AxiosInstance, ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<DamAssetLicenceGroup>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute(ids)
}

export const useFetchDamAssetLicenceGroupList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetLicenceGroup>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

// /**
//  * @deprecated
//  */
// export const fetchDamAssetLicenceGroupList = (
//   client: () => AxiosInstance,
//   pagination: Pagination,
//   filterBag: FilterBag
// ) => apiFetchList<DamAssetLicenceGroup[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)
