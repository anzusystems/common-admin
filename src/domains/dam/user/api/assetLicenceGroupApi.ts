import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { IntegerId } from '@/shared/types/common'
import type { DamAssetLicenceGroup } from '@/domains/dam/types/AssetLicenceGroup'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'

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
