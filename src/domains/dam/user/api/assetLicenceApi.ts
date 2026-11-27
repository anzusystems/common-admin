import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { DamAssetLicence } from '@/domains/dam/types/AssetLicence'
import type { IntegerId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'

const END_POINT = '/adm/v1/asset-licence'
export const ENTITY = 'assetLicence'

/** `endPoint`: the licences endpoint from a configuration (`endPointAssetLicence`). Defaults to `/adm/v1/asset-licence`. */
export const fetchDamAssetLicenceListByIds = (
  client: () => AxiosInstance,
  ids: IntegerId[],
  endPoint: string = END_POINT
) => {
  const { execute } = useApiFetchByIds<DamAssetLicence>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint,
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
