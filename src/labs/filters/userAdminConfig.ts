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
  endPoint: string = END_POINT,
) {
  const useFetchUserAdminConfigList = () =>
    useApiFetchList<UserAdminConfig[]>({ client, system, entity, urlTemplate: END_POINT })

  const fetchUserAdminConfig = (id: IntegerId) => {
    const { executeRequest } = useApiRequest<UserAdminConfig>({
      client,
      method: 'GET',
      system,
      entity,
    })
    return executeRequest({ urlTemplate: endPoint + '/:id', urlParams: { id } })
  }

  const createUserAdminConfig = (data: UserAdminConfig) => {
    const { executeRequest } = useApiRequest<UserAdminConfig>({
      client,
      method: 'POST',
      system,
      entity,
    })
    return executeRequest({ urlTemplate: endPoint, object: data })
  }

  const updateUserAdminConfig = (id: IntegerId, data: UserAdminConfig) => {
    const { executeRequest } = useApiRequest<UserAdminConfig>({
      client,
      method: 'PUT',
      system,
      entity,
    })
    return executeRequest({ urlTemplate: endPoint + '/:id', urlParams: { id }, object: data })
  }

  const deleteUserAdminConfig = (id: IntegerId) => {
    const { executeRequest } = useApiRequest({ client, method: 'DELETE', system, entity })
    return executeRequest({ urlTemplate: endPoint + '/:id', urlParams: { id } })
  }

  const updateUserAdminConfigPositions = (ids: IntegerId[]) => {
    const { executeRequest } = useApiRequest<{ userAdminConfigs: IntegerId[] }>({
      client,
      method: 'PATCH',
      system,
      entity,
    })
    return executeRequest({
      urlTemplate: endPoint + '/update-positions',
      object: { userAdminConfigs: ids },
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
