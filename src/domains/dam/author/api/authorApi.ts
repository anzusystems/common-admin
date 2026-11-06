import type { AxiosInstance } from 'axios'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import type { IntegerId } from '@/shared/types/common'

// The application sets the authors address (`endPointAuthor` of its DAM configuration).
const LIST = '/ext-system/:extSystemId'
export const ENTITY = 'author'

export const fetchAuthorListByIds = (
  client: () => AxiosInstance,
  endPoint: string,
  extSystemId: number,
  ids: string[]
) => {
  const { execute } = useApiFetchByIds<DamAuthor>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + LIST + '/search',
    urlParams: { extSystemId },
    isSearchApi: true,
  })

  return execute(ids)
}

export const useFetchAuthorList = (client: () => AxiosInstance, endPoint: string, extSystemId: IntegerId) =>
  useApiFetchList<DamAuthor>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + LIST,
    urlParams: { extSystemId },
  })

export const createAuthor = (client: () => AxiosInstance, endPoint: string, data: DamAuthor) => {
  const { execute } = useApiRequest<DamAuthor, DamAuthor>({
    client,
    method: 'POST',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint,
  })

  return execute({ body: data })
}
