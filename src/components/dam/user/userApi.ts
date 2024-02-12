import type { AxiosInstance } from 'axios'
import type { DamUser, DamUserUpdateDto } from '@/components/dam/user/DamUser'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/apiFetchList'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'

const END_POINT = '/adm/v1/user'
export const ENTITY = 'user'

export const fetchDamUserListByIds = (client: () => AxiosInstance, ids: number[]) =>
  apiFetchByIds<DamUser[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const fetchDamUserList = (client: () => AxiosInstance, pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<DamUser[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)

export const updateDamUser = (client: () => AxiosInstance, id: number, data: DamUserUpdateDto) =>
  apiUpdateOne<DamUserUpdateDto, DamUser>(client, data, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const fetchDamUser = (client: () => AxiosInstance, id: number) =>
  apiFetchOne<DamUser>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
