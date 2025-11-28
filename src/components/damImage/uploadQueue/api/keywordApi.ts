import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamKeyword } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { Pagination } from '@/types/Pagination'
// eslint-disable-next-line deprecation/no-deprecated-imports
import type { FilterBag } from '@/types/Filter'
// eslint-disable-next-line deprecation/no-deprecated-imports
import { apiFetchList } from '@/services/api/apiFetchList'

const END_POINT = '/adm/v1/keyword'
const END_POINT_LIST = END_POINT + '/ext-system/:extSystemId'
export const ENTITY = 'keyword'

export const fetchKeywordListByIds = (client: () => AxiosInstance, extSystemId: number, ids: string[]) =>
  apiFetchByIds<DamKeyword[]>(
    client,
    ids,
    END_POINT_LIST + '/search',
    { extSystemId },
    SYSTEM_CORE_DAM,
    ENTITY,
    {},
    true
  )

export const useFetchKeywordList = (client: () => AxiosInstance, extSystemId: number) =>
  useApiFetchList<DamKeyword[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT_LIST, { extSystemId })

/**
 * @deprecated
 */
export const fetchKeywordList = (
  client: () => AxiosInstance,
  extSystemId: number,
  pagination: Pagination,
  filterBag: FilterBag
) => apiFetchList<DamKeyword[]>(client, END_POINT_LIST, { extSystemId }, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)

export const createKeyword = (client: () => AxiosInstance, data: DamKeyword) =>
  apiCreateOne<DamKeyword>(client, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)
