import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { IntegerId } from '@/types/common'

const END_POINT = '/adm/v1/author'
const END_POINT_LIST = END_POINT + '/ext-system/:extSystemId'
export const ENTITY = 'author'

export const fetchAuthorListByIds = (client: () => AxiosInstance, extSystemId: number, ids: string[]) =>
  apiFetchByIds<DamAuthor[]>(
    client,
    ids,
    END_POINT_LIST + '/search',
    {
      extSystemId,
    },
    SYSTEM_CORE_DAM,
    ENTITY,
    {},
    true
  )

export const useFetchAuthorList = (client: () => AxiosInstance, extSystemId: IntegerId) =>
  useApiFetchList<DamAuthor[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT_LIST, { extSystemId })

export const createAuthor = (client: () => AxiosInstance, data: DamAuthor) =>
  apiCreateOne<DamAuthor>(client, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)
