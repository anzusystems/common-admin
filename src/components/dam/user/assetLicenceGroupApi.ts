import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { IntegerId } from '@/types/common'
import type { DamAssetLicenceGroup } from '@/types/coreDam/AssetLicenceGroup'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

const END_POINT = '/adm/v1/asset-licence-group'
export const ENTITY = 'assetLicenceGroup'

export const fetchDamAssetLicenceGroupListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<DamAssetLicenceGroup[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY, {}, false)

export const useFetchDamAssetLicenceGroupList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetLicenceGroup[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT)
