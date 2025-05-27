import type { AxiosInstance } from 'axios'
import { useApiFetchList } from '@/services/api/v2/useApiFetchList'
import { apiCreateOne2 } from '@/services/api/v2/apiCreateOne2'
import { apiUpdateOne2 } from '@/services/api/v2/apiUpdateOne2'
import type { IntegerId } from '@/types/common'
import { apiDeleteOne2 } from '@/services/api/v2/apiDeleteOne2'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { UserAdminConfig } from '@/types/UserAdminConfig'
import { apiAnyRequest2 } from '@/services/api/v2/apiAnyRequest2'

const END_POINT = '/adm/v1/user-admin-config'
const ENTITY = 'userAdminConfig'

export function useUserAdminConfigApi(
  client: () => AxiosInstance,
  system: string,
  entity: string = ENTITY,
  endPoint: string = END_POINT
) {
  const useFetchUserAdminConfigList = () => useApiFetchList<UserAdminConfig[]>(client, endPoint, {}, system, entity)

  const fetchUserAdminConfig = (id: IntegerId) =>
    apiFetchOne<UserAdminConfig>(client, END_POINT + '/:id', { id }, system, ENTITY)

  const createUserAdminConfig = (data: UserAdminConfig) =>
    apiCreateOne2<UserAdminConfig>(client, data, endPoint, {}, system, entity)

  const updateUserAdminConfig = (id: IntegerId, data: UserAdminConfig) =>
    apiUpdateOne2<UserAdminConfig>(client, data, endPoint + '/:id', { id }, system, entity)

  const deleteUserAdminConfig = (id: IntegerId) =>
    apiDeleteOne2<UserAdminConfig>(client, endPoint + '/:id', { id }, system, entity)

  const updateUserAdminConfigPositions = (ids: IntegerId[]) =>
    apiAnyRequest2<{ userAdminConfigs: IntegerId[] }, any>(
      client,
      'PATCH',
      endPoint + '/update-positions',
      undefined,
      { userAdminConfigs: ids },
      system,
      entity
    )

  return {
    useFetchUserAdminConfigList,
    fetchUserAdminConfig,
    createUserAdminConfig,
    updateUserAdminConfig,
    deleteUserAdminConfig,
    updateUserAdminConfigPositions,
  }
}
