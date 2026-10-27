import type { AxiosClientFn } from '@/domains/api/utils/client'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import type { PermissionConfig } from '@/domains/permission/config/types/PermissionConfig'

export const PERMISSION_CONFIG_ENTITY = 'permissionConfig'
export const PERMISSION_CONFIG_ENDPOINT = '/adm/v1/permissions/config'

export interface PermissionConfigApiParams {
  client: AxiosClientFn
  /**
   * Which backend this instance talks to. It reaches `useApiRequest` for error context.
   * It is also the storage key downstream, so two systems can be loaded side by side.
   */
  system: string
  /**
   * Goes into every `useApiRequest` call; see the per-system entity note in `permissionGroupApi`.
   */
  entity?: string
  endPoint?: string
}

export const usePermissionConfigApi = ({
  client,
  system,
  entity = PERMISSION_CONFIG_ENTITY,
  endPoint = PERMISSION_CONFIG_ENDPOINT,
}: PermissionConfigApiParams) => {
  const useFetchPermissionConfig = () =>
    useApiRequest<PermissionConfig, null>({
      client,
      method: 'GET',
      system,
      entity,
      // The config endpoint never returns field-level validation failures.
      // The pair stays consistent with the rest of the shared api so a future one gets real labels.
      validationSystem: 'common',
      validationEntity: entity,
      urlTemplate: endPoint,
    })

  return {
    useFetchPermissionConfig,
  }
}
