import type { AxiosInstance } from 'axios'
import type { DamUser, DamUserUpdateDto } from '@/components/dam/user/DamUser'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'

const END_POINT = '/adm/v1/user'
export const ENTITY = 'user'

export const fetchDamUserListByIds = (client: () => AxiosInstance, ids: number[]) =>
  apiFetchByIds<DamUser[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const useFetchDamUserList = (client: () => AxiosInstance) =>
  useApiFetchList<DamUser[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT)

export const updateDamUser = (client: () => AxiosInstance, id: number, data: DamUserUpdateDto) =>
  apiUpdateOne<DamUserUpdateDto, DamUser>(client, data, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const fetchDamUser = (client: () => AxiosInstance, id: number) =>
  apiFetchOne<DamUser>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
