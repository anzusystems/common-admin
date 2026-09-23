import type { AxiosClientFn } from '@/labs/api/client'
import { useCachedPermissionGroups } from '@/labs/permissionGroup/cachedPermissionGroups'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import { isUndefined } from '@/utils/common'
import { objectGetValueByPath, objectSetValueByPath } from '@/utils/object'

export interface PermissionActionsParams {
  client: AxiosClientFn
  system: string
  entity?: string
  endPoint?: string
}

/**
 * Builds the grant map a user would end up with, for the editor's "resolved" column, out of what
 * the page already holds: the groups the user is in plus the grants set on the user directly.
 *
 * It is not the backend's `resolvedPermissions`. That one arrives with the record and includes
 * roles; this one is what the screen would send if saved now, so the editor can show the effect of
 * a group the operator has just ticked without a round trip.
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

  /** A grant set on the user directly always beats whatever the groups say. */
  const resolvePermissions = (user: AnzuUser): Permissions => ({
    ...resolveGroupPermissions(user.permissionGroups),
    ...user.permissions,
  })

  return {
    resolvePermissions,
    resolveGroupPermissions,
  }
}
