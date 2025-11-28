import type { AxiosInstance } from 'axios'
import type { DamUser, DamUserUpdateDto } from '@/components/dam/user/DamUser'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
// eslint-disable-next-line deprecation/no-deprecated-imports
import { apiFetchList } from '@/services/api/apiFetchList'
import type { Pagination } from '@/types/Pagination'
// eslint-disable-next-line deprecation/no-deprecated-imports
import type { FilterBag } from '@/types/Filter'

const END_POINT = '/adm/v1/user'
export const ENTITY = 'user'

export const fetchDamUserListByIds = (client: () => AxiosInstance, ids: number[]) =>
  apiFetchByIds<DamUser[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

/**
 * @deprecated
 */
export const fetchDamUserList = (client: () => AxiosInstance, pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<DamUser[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)

export const useFetchDamUserList = (client: () => AxiosInstance) =>
  useApiFetchList<DamUser[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT)

export const updateDamUser = (client: () => AxiosInstance, id: number, data: DamUserUpdateDto) =>
  apiUpdateOne<DamUserUpdateDto, DamUser>(client, data, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const fetchDamUser = (client: () => AxiosInstance, id: number) =>
  apiFetchOne<DamUser>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
