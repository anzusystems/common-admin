import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

const END_POINT = '/adm/v1/asset-licence'
export const ENTITY = 'assetLicence'

export const fetchDamAssetLicenceListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<DamAssetLicence[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const useFetchDamAssetLicenceList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetLicence[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT)
