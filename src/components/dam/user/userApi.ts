import type { AxiosInstance } from 'axios'
import type { DamUser, DamUserUpdateDto } from '@/components/dam/user/DamUser'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiRequest } from '@/labs/api/useApiRequest'
// eslint-disable-next-line anzu/no-deprecated-imports
import { apiFetchList } from '@/services/api/apiFetchList'
import type { Pagination } from '@/types/Pagination'
// eslint-disable-next-line anzu/no-deprecated-imports
import type { FilterBag } from '@/types/Filter'

const END_POINT = '/adm/v1/user'
export const ENTITY = 'user'

export const fetchDamUserListByIds = (client: () => AxiosInstance, ids: number[]) => {
  const { executeFetch } = useApiFetchByIds<DamUser[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return executeFetch(ids)
}

/**
 * @deprecated
 */
export const fetchDamUserList = (client: () => AxiosInstance, pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<DamUser[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)

export const useFetchDamUserList = (client: () => AxiosInstance) =>
  useApiFetchList<DamUser[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

export const updateDamUser = (client: () => AxiosInstance, id: number, data: DamUserUpdateDto) => {
  const { executeRequest } = useApiRequest<DamUser, DamUserUpdateDto>({
    client,
    method: 'PUT',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return executeRequest({ urlParams: { id }, object: data })
}

export const fetchDamUser = (client: () => AxiosInstance, id: number) => {
  const { executeRequest } = useApiRequest<DamUser, null>({
    client,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return executeRequest({ urlParams: { id } })
}
