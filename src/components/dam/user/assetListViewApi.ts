import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamAssetListViewResolved } from '@/types/coreDam/AssetListView'
import type { IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

const END_POINT = '/adm/v1/asset-list-view'
export const ENTITY = 'assetListView'

export const fetchDamAssetListViewListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<DamAssetListViewResolved[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const useFetchDamAssetListViewList = (client: () => AxiosInstance) =>
  useApiFetchList<DamAssetListViewResolved[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })
