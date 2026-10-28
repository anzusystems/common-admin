import type { AxiosClientFn } from '@/domains/api/utils/client'
import { useApiCommand, useApiRequest } from '@/domains/api/composables/useApiRequest'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import type { PermissionGroup } from '@/domains/permission/group/types/PermissionGroup'

export const PERMISSION_GROUP_ENTITY = 'permissionGroup'
export const PERMISSION_GROUP_ENDPOINT = '/adm/v1/permission-group'

export interface PermissionGroupApiParams {
  client: AxiosClientFn
  /**
   * Both reach every `useApiRequest` built here, and both must be passed, not assumed.
   * admin-cms declared `SYSTEM_COMMON` but sent `SYSTEM_CMS` on
   * one of four calls, reporting two systems for one endpoint.
   * One file that is told its system cannot have that bug.
   */
  system: string
  entity?: string
  /**
   * i18n scope for server-side validation failures, separate from which backend answered.
   * `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys. For a component shared by
   * nine backends the labels are the library's `common.*`; `weather.anzuUser.model.email` does not exist.
   * Defaults to `common` plus the entity. contentHub passes its own pair to keep its existing keys.
   */
  validationSystem?: string
  validationEntity?: string
  endPoint?: string
}

export const usePermissionGroupApi = ({
  client,
  system,
  entity = PERMISSION_GROUP_ENTITY,
  validationSystem = 'common',
  validationEntity = entity,
  endPoint = PERMISSION_GROUP_ENDPOINT,
}: PermissionGroupApiParams) => {
  const scope = { validationSystem, validationEntity }
  const useFetchPermissionGroupListByIds = () =>
    useApiFetchByIds<PermissionGroup>({ client, system, entity, ...scope, urlTemplate: endPoint })

  const useFetchPermissionGroupList = () =>
    useApiFetchList<PermissionGroup>({ client, system, entity, ...scope, urlTemplate: endPoint })

  const useFetchPermissionGroup = () =>
    useApiRequest<PermissionGroup, null>({
      client,
      ...scope,
      method: 'GET',
      system,
      entity,
      urlTemplate: endPoint + '/:id',
    })

  const useCreatePermissionGroup = () =>
    useApiRequest<PermissionGroup, PermissionGroup>({
      client,
      ...scope,
      method: 'POST',
      system,
      entity,
      urlTemplate: endPoint,
    })

  const useUpdatePermissionGroup = () =>
    useApiRequest<PermissionGroup, PermissionGroup>({
      client,
      ...scope,
      method: 'PUT',
      system,
      entity,
      urlTemplate: endPoint + '/:id',
    })

  const useDeletePermissionGroup = () =>
    useApiCommand<null>({
      client,
      ...scope,
      method: 'DELETE',
      system,
      entity,
      urlTemplate: endPoint + '/:id',
    })

  return {
    useFetchPermissionGroupListByIds,
    useFetchPermissionGroupList,
    useFetchPermissionGroup,
    useCreatePermissionGroup,
    useUpdatePermissionGroup,
    useDeletePermissionGroup,
  }
}
