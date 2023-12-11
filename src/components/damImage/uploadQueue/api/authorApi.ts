import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiFetchList } from '@/services/api/apiFetchList'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'

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

export const fetchAuthorList = (
  client: () => AxiosInstance,
  extSystemId: number,
  pagination: Pagination,
  filterBag: FilterBag
) =>
  apiFetchList<DamAuthor[]>(
    client,
    END_POINT_LIST,
    {
      extSystemId,
    },
    pagination,
    filterBag,
    SYSTEM_CORE_DAM,
    ENTITY
  )

export const createAuthor = (client: () => AxiosInstance, data: DamAuthor) =>
  apiCreateOne<DamAuthor>(client, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

