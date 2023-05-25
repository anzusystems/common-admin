import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList } from '@/lib'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

class AssetCustomData {}

export interface AssetMetadataBulkItem {
  id: DocId
  keywords: DocId[]
  authors: DocId[]
  described: boolean
  customData: AssetCustomData
}

const END_POINT = '/adm/v1/asset'
export const ENTITY = 'asset'
export const SYSTEM_CORE_DAM = 'coreDam'

// todo return type
export function useDamApi(client: () => AxiosInstance) {
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
