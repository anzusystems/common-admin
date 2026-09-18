import type { AxiosInstance } from 'axios'
// eslint-disable-next-line anzu/no-deprecated-imports
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
// eslint-disable-next-line anzu/no-deprecated-imports
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { IntegerId } from '@/types/common'
import type { Pagination } from '@/types/Pagination'

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
  useApiFetchList<DamAuthor[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT_LIST,
    urlParams: { extSystemId },
  })

export const createAuthor = (client: () => AxiosInstance, data: DamAuthor) =>
  apiCreateOne<DamAuthor>(client, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)
