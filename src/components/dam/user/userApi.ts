import type { DamUserUpdateDto, FilterBag, Pagination } from '@anzusystems/common-admin'
import { apiFetchByIds, apiFetchList, apiFetchOne, apiUpdateOne } from '@anzusystems/common-admin'
import type { AxiosInstance } from 'axios'
import type { DamUser } from '@/components/dam/user/DamUser'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

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
