import type { AxiosInstance } from 'axios'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiRequest } from '@/labs/api/useApiRequest'
import type { IntegerId } from '@/types/common'

const END_POINT = '/adm/v1/author'
const END_POINT_LIST = END_POINT + '/ext-system/:extSystemId'
export const ENTITY = 'author'

export const fetchAuthorListByIds = (client: () => AxiosInstance, extSystemId: number, ids: string[]) => {
  const { execute } = useApiFetchByIds<DamAuthor>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST + '/search',
    urlParams: { extSystemId },
    isSearchApi: true,
  })

  return execute(ids)
}

export const useFetchAuthorList = (client: () => AxiosInstance, extSystemId: IntegerId) =>
  useApiFetchList<DamAuthor>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST,
    urlParams: { extSystemId },
  })

export const createAuthor = (client: () => AxiosInstance, data: DamAuthor) => {
  const { execute } = useApiRequest<DamAuthor, DamAuthor>({
    client,
    method: 'POST',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute({ body: data })
}
