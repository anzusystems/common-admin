import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { IntegerId } from '@/types/common'
import type { DamAssetLicenceGroup } from '@/types/coreDam/AssetLicenceGroup'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { Pagination } from '@/types/Pagination'
// eslint-disable-next-line deprecation/no-deprecated-imports
import type { FilterBag } from '@/types/Filter'
// eslint-disable-next-line deprecation/no-deprecated-imports
import { apiFetchList } from '@/services/api/apiFetchList'

const END_POINT = '/adm/v1/asset-licence-group'
export const ENTITY = 'assetLicenceGroup'

export const fetchDamAssetLicenceGroupListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<DamAssetLicenceGroup[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY, {}, false)

export const useFetchDamAssetLicenceGroupList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetLicenceGroup[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT)

/**
 * @deprecated
 */
export const fetchDamAssetLicenceGroupList = (
  client: () => AxiosInstance,
  pagination: Pagination,
  filterBag: FilterBag
) => apiFetchList<DamAssetLicenceGroup[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)
