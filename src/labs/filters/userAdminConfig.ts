import type { AxiosInstance } from 'axios'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { IntegerId } from '@/types/common'
import type { UserAdminConfig } from '@/types/UserAdminConfig'
import { useApiRequest } from '@/labs/api/useApiRequest'

export const END_POINT = '/adm/v1/user-admin-config'
const ENTITY = 'userAdminConfig'

export function useUserAdminConfigApi(
  client: () => AxiosInstance,
  system: string,
  entity: string = ENTITY,
  endPoint: string = END_POINT
) {
  const useFetchUserAdminConfigList = () => useApiFetchList<UserAdminConfig[]>(client, system, entity)

  const fetchUserAdminConfig = (id: IntegerId) => {
    const { executeRequest } = useApiRequest<UserAdminConfig>(client, 'GET', system, entity)
    return executeRequest(endPoint + '/:id', { id })
  }

  const createUserAdminConfig = (data: UserAdminConfig) => {
    const { executeRequest } = useApiRequest<UserAdminConfig>(client, 'POST', system, entity)
    return executeRequest(endPoint, undefined, data)
  }

  const updateUserAdminConfig = (id: IntegerId, data: UserAdminConfig) => {
    const { executeRequest } = useApiRequest<UserAdminConfig>(client, 'PUT', system, entity)
    return executeRequest(endPoint + '/:id', { id }, data)
  }

  const deleteUserAdminConfig = (id: IntegerId) => {
    const { executeRequest } = useApiRequest(client, 'DELETE', system, entity)
    return executeRequest(endPoint + '/:id', { id })
  }

  const updateUserAdminConfigPositions = (ids: IntegerId[]) => {
    const { executeRequest } = useApiRequest<{ userAdminConfigs: IntegerId[] }>(client, 'PATCH', system, entity)
    return executeRequest(endPoint + '/update-positions', undefined, { userAdminConfigs: ids })
  }

  return {
    useFetchUserAdminConfigList,
    fetchUserAdminConfig,
    createUserAdminConfig,
    updateUserAdminConfig,
    deleteUserAdminConfig,
    updateUserAdminConfigPositions,
  }
}
