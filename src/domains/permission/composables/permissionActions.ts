import type { AxiosClientFn } from '@/domains/api/utils/client'
import { useCachedPermissionGroups } from '@/domains/permission/group/composables/cachedPermissionGroups'
import type { AnzuUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'
import type { Permissions } from '@/domains/auth/types/Permission'
import { isUndefined } from '@/shared/utils/common'
import { objectGetValueByPath, objectSetValueByPath } from '@/shared/utils/object'

export interface PermissionActionsParams {
  client: AxiosClientFn
  system: string
  entity?: string
  endPoint?: string
}

/**
 * Builds the user's resulting grant map for the editor's "resolved" column, from the user's groups plus direct grants.
 * This is not the backend's `resolvedPermissions`, which includes roles. It reflects what
 * a save would send now, so a just-ticked group shows its effect without a round trip.
 */
export const usePermissionActions = (params: PermissionActionsParams) => {
  const { getCachedPermissionGroup } = useCachedPermissionGroups(params)

  const resolveGroupPermissions = (permissionGroupIds: IntegerId[]): Permissions => {
    const permissions: Permissions = {}
    const permissionGroups = permissionGroupIds.map((id) => getCachedPermissionGroup(id))

    for (const permissionGroup of permissionGroups) {
      if (isUndefined(permissionGroup)) continue
      for (const permissionName in permissionGroup.permissions) {
        const grant = objectGetValueByPath(permissionGroup.permissions, permissionName)
        if (!Object.hasOwn(permissions, permissionName)) {
          objectSetValueByPath(permissions, permissionName, grant)
          continue
        }
        // Grants are ordered deny < allowOwner < allow, so the widest group wins. Two groups that
        // disagree do not cancel out.
        if (objectGetValueByPath(permissions, permissionName) < grant) {
          objectSetValueByPath(permissions, permissionName, grant)
        }
      }
    }
    return permissions
  }

  /**
   * A grant set on the user directly always beats whatever the groups say.
   */
  const resolvePermissions = (user: AnzuUser): Permissions => ({
    ...resolveGroupPermissions(user.permissionGroups),
    ...user.permissions,
  })

  return {
    resolvePermissions,
    resolveGroupPermissions,
  }
}
