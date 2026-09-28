import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damConstants'
import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'

const END_POINT = '/adm/v1/asset-licence'
export const ENTITY = 'assetLicence'

export const fetchDamAssetLicenceListByIds = (client: () => AxiosInstance, ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<DamAssetLicence>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute(ids)
}

export const useFetchDamAssetLicenceList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetLicence>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })
