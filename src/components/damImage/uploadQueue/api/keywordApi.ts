import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamKeyword } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

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

export const createKeyword = (client: () => AxiosInstance, data: DamKeyword) =>
  apiCreateOne<DamKeyword>(client, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)
