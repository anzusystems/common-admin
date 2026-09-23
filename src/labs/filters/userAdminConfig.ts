import type { AxiosInstance } from 'axios'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { IntegerId } from '@/types/common'
import type { UserAdminConfig } from '@/types/UserAdminConfig'
import { useApiCommand, useApiRequest } from '@/labs/api/useApiRequest'

export const END_POINT = '/adm/v1/user-admin-config'
const ENTITY = 'userAdminConfig'

export function useUserAdminConfigApi(
  client: () => AxiosInstance,
  system: string,
  entity: string = ENTITY,
  endPoint: string = END_POINT
) {
  const useFetchUserAdminConfigList = () =>
    useApiFetchList<UserAdminConfig>({ client, system, entity, urlTemplate: END_POINT })

  const fetchUserAdminConfig = (id: IntegerId) => {
    const { execute } = useApiRequest<UserAdminConfig>({
      client,
      method: 'GET',
      system,
      entity,
    })
    return execute({ urlTemplate: endPoint + '/:id', urlParams: { id } })
  }

  const createUserAdminConfig = (data: UserAdminConfig) => {
    const { execute } = useApiRequest<UserAdminConfig, UserAdminConfig>({
      client,
      method: 'POST',
      system,
      entity,
    })
    return execute({ urlTemplate: endPoint, body: data })
  }

  const updateUserAdminConfig = (id: IntegerId, data: UserAdminConfig) => {
    const { execute } = useApiRequest<UserAdminConfig, UserAdminConfig>({
      client,
      method: 'PUT',
      system,
      entity,
    })
    return execute({ urlTemplate: endPoint + '/:id', urlParams: { id }, body: data })
  }

  const deleteUserAdminConfig = (id: IntegerId) => {
    const { execute } = useApiCommand({ client, method: 'DELETE', system, entity })
    return execute({ urlTemplate: endPoint + '/:id', urlParams: { id } })
  }

  const updateUserAdminConfigPositions = (ids: IntegerId[]) => {
    const { execute } = useApiRequest<{ userAdminConfigs: IntegerId[] }, { userAdminConfigs: IntegerId[] }>({
      client,
      method: 'PATCH',
      system,
      entity,
    })
    return execute({
      urlTemplate: endPoint + '/update-positions',
      body: { userAdminConfigs: ids },
    })
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
