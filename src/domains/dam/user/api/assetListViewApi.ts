import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { DamAssetListViewMinimal } from '@/domains/dam/types/AssetListView'
import type { IntegerId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'

const END_POINT = '/adm/v1/asset-list-view'
export const ENTITY = 'assetListView'

/** `endPoint`: the list views endpoint of the caller's DAM. Defaults to `/adm/v1/asset-list-view`. */
export const fetchDamAssetListViewListByIds = (
  client: () => AxiosInstance,
  ids: IntegerId[],
  endPoint: string = END_POINT
) => {
  const { execute } = useApiFetchByIds<DamAssetListViewMinimal>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint,
  })

  return execute(ids)
}

export const useFetchDamAssetListViewList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetListViewMinimal>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })
