import type { AxiosInstance } from 'axios'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { DamAuthor } from '@/components/damImage/uploadQueue/authors/DamAuthor'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

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

// export const fetchAuthorList = (extSystemId: number, pagination: Pagination, filterBag: FilterBag) =>
//   apiFetchList<DamAuthor[]>(
//     damClient,
//     END_POINT_LIST,
//     {
//       extSystemId,
//     },
//     pagination,
//     filterBag,
//     SYSTEM_CORE_DAM,
//     ENTITY
//   )
//
// export const createAuthor = (data: DamAuthor) =>
//   apiCreateOne<DamAuthor>(damClient, data, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)
//
// export const updateAuthor = (id: string, data: DamAuthor) =>
//   apiUpdateOne<DamAuthor>(damClient, data, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
//
// export const fetchAuthor = (id: string) =>
//   apiFetchOne<DamAuthor>(damClient, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
