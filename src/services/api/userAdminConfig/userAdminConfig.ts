import type { AxiosInstance } from 'axios'
import type { Pagination } from '@/types/Pagination'
import { apiFetchList2 } from '@/services/api/v2/apiFetchList2'
import { apiCreateOne } from '@/services/api/v2/apiCreateOne'
import { apiUpdateOne } from '@/services/api/v2/apiUpdateOne'
import type { IntegerId } from '@/types/common'
import type { FilterConfig, FilterData } from '@/composables/filter/filterFactory'
import { apiDeleteOne } from '@/services/api/v2/apiDeleteOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { UserAdminConfig } from '@/types/UserAdminConfig'
import { apiAnyRequest } from '@/services/api/v2/apiAnyRequest'

const END_POINT = '/adm/v1/user-admin-config'
const ENTITY = 'userAdminConfig'

export function useUserAdminConfigApi(
  client: () => AxiosInstance,
  system: string,
  entity: string = ENTITY,
  endPoint: string = END_POINT
) {
  const fetchUserAdminConfigList = (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) =>
    apiFetchList2<UserAdminConfig[]>(client, endPoint, {}, pagination, filterData, filterConfig, system, entity)

  const fetchUserAdminConfig = (id: IntegerId) =>
    apiFetchOne<UserAdminConfig>(client, END_POINT + '/:id', { id }, system, ENTITY)

  const createUserAdminConfig = (data: UserAdminConfig) =>
    apiCreateOne<UserAdminConfig>(client, data, endPoint, {}, system, entity)

  const updateUserAdminConfig = (id: IntegerId, data: UserAdminConfig) =>
    apiUpdateOne<UserAdminConfig>(client, data, endPoint + '/:id', { id }, system, entity)

  const deleteUserAdminConfig = (id: IntegerId) =>
    apiDeleteOne<UserAdminConfig>(client, endPoint + '/:id', { id }, system, entity)

  const updateUserAdminConfigPositions = (ids: IntegerId[]) =>
    apiAnyRequest<{ userAdminConfigs: IntegerId[] }, any>(
      client,
      'PATCH',
      endPoint + '/update-positions',
      undefined,
      { userAdminConfigs: ids },
      system,
      entity
    )

  return {
    fetchUserAdminConfigList,
    fetchUserAdminConfig,
    createUserAdminConfig,
    updateUserAdminConfig,
    deleteUserAdminConfig,
    updateUserAdminConfigPositions,
  }
}
