import type { AxiosInstance } from 'axios'
import type { DamKeyword } from '@/domains/dam/keyword/types/DamKeyword'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'

const END_POINT = '/adm/v1/keyword'
const END_POINT_LIST = END_POINT + '/ext-system/:extSystemId'
export const ENTITY = 'keyword'

export const fetchKeywordListByIds = (client: () => AxiosInstance, extSystemId: number, ids: string[]) => {
  const { execute } = useApiFetchByIds<DamKeyword>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST + '/search',
    urlParams: { extSystemId },
    isSearchApi: true,
  })

  return execute(ids)
}

export const useFetchKeywordList = (client: () => AxiosInstance, extSystemId: number) =>
  useApiFetchList<DamKeyword>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST,
    urlParams: { extSystemId },
  })

export const createKeyword = (client: () => AxiosInstance, data: DamKeyword) => {
  const { execute } = useApiRequest<DamKeyword, DamKeyword>({
    client,
    method: 'POST',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute({ body: data })
}
