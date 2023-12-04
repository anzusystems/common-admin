import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamKeyword } from '@/components/damImage/uploadQueue/keywords/DamKeyword'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

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

// export const fetchKeywordList = (extSystemId: number, pagination: Pagination, filterBag: FilterBag) =>
//   apiFetchList<DamKeyword[]>(damClient, END_POINT_LIST, { extSystemId }, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)
//
// export const createKeyword = (data: DamKeyword) =>
//   apiCreateOne<DamKeyword>(damClient, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)
//
// export const updateKeyword = (id: string, data: DamKeyword) =>
//   apiUpdateOne<DamKeyword>(damClient, data, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
//
// export const fetchKeyword = (id: string) =>
//   apiFetchOne<DamKeyword>(damClient, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
