import type { AxiosClientFn } from '@/labs/api/client'
import { useApiCommand, useApiRequest } from '@/labs/api/useApiRequest'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { PermissionGroup } from '@/types/PermissionGroup'

export const PERMISSION_GROUP_ENTITY = 'permissionGroup'
export const PERMISSION_GROUP_ENDPOINT = '/adm/v1/permission-group'

export interface PermissionGroupApiParams {
  client: AxiosClientFn
  /**
   * Both of these reach every `useApiRequest` this builds, and both have to be taken rather than
   * assumed. admin-cms is the proof: its `permissionGroupApi.ts` declared `SYSTEM_COMMON` at the
   * top and then sent `SYSTEM_CMS` on one of its four calls, so the same file reported two
   * different systems for the same endpoint. A copy of that file per system multiplies the bug;
   * one file that is told which system it is cannot have it.
   */
  system: string
  entity?: string
  /**
   * i18n scope for a server-side validation failure, which is a different question from which
   * backend answered. `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys, and
   * for a component shared by nine backends the labels are always the library's own `common.*` --
   * `weather.anzuUser.model.email` exists nowhere. Defaults to `common` plus the entity;
   * contentHub passes its own pair to keep the keys it already has.
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
