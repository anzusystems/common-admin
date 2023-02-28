import type { IntegerId } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export interface AnzuUser extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  email: string
  enabled: boolean
  roles: string[]
  permissionGroups: IntegerId[]
  permissions: Permissions
  resolvedPermissions: Permissions
  _resourceName: string
  _system: string
}
