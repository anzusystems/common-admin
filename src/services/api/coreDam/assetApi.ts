import type { AxiosInstance } from 'axios'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList } from '@/lib'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

const END_POINT = '/adm/v1/asset'
export const ENTITY = 'asset'
export const SYSTEM_CORE_DAM = 'coreDam'

export function useAssetApi(client: () => AxiosInstance) {
  const fetchAssetList = (licenceId: number, pagination: Pagination, filterBag: FilterBag) =>
    apiFetchList<AssetSearchListItemDto[]>(
      client,
      END_POINT + '/licence/:licenceId',
      { licenceId },
      pagination,
      filterBag,
      SYSTEM_CORE_DAM,
      ENTITY
    )

  return {
    fetchAssetList,
  }
}
