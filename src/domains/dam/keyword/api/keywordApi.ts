import type { AxiosInstance } from 'axios'
import type { DamKeyword } from '@/domains/dam/keyword/types/DamKeyword'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'

// The address of the keywords is the application's to say (`endPointKeyword` of its DAM configuration).
const LIST = '/ext-system/:extSystemId'
export const ENTITY = 'keyword'

export const fetchKeywordListByIds = (
  client: () => AxiosInstance,
  endPoint: string,
  extSystemId: number,
  ids: string[]
) => {
  const { execute } = useApiFetchByIds<DamKeyword>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + LIST + '/search',
    urlParams: { extSystemId },
    isSearchApi: true,
  })

  return execute(ids)
}

export const useFetchKeywordList = (client: () => AxiosInstance, endPoint: string, extSystemId: number) =>
  useApiFetchList<DamKeyword>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + LIST,
    urlParams: { extSystemId },
  })

export const createKeyword = (client: () => AxiosInstance, endPoint: string, data: DamKeyword) => {
  const { execute } = useApiRequest<DamKeyword, DamKeyword>({
    client,
    method: 'POST',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint,
  })

  return execute({ body: data })
}
