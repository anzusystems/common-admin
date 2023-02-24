import type { IntegerId } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export interface AnzuUser extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  email: string
  person: {
    firstName: string
    lastName: string
    fullName: string
  }
  avatar: {
    color: string
    text: string
  }
  enabled: boolean
  roles: string[]
  permissionGroups: IntegerId[]
  permissions: Permissions
  resolvedPermissions: Permissions
  _resourceName: string
  _system: string
}
