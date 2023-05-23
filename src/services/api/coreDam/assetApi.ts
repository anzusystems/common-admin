import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList, isNull } from '@/lib'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import axios from 'axios'

class AssetCustomData {
}

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

// todo remove
const token = ''

let mainInstance: AxiosInstance | null = null

// todo move to client
const damClient = function (
): AxiosInstance {
  if (isNull(mainInstance)) {
    mainInstance = axios.create({
      baseURL: 'http://core-dam.sme.localhost/api',
      timeout: 15 * 1000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  return mainInstance
}

// todo return type
export function useDamApi() {
  const fetchAssetList = (licenceId: number, pagination: Pagination, filterBag: FilterBag) =>
    apiFetchList<AssetSearchListItemDto[]>(
      damClient,
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
