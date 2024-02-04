import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export interface AnzuUserMinimal {
  id: IntegerId
  person: {
    firstName: string
    lastName: string
    fullName: string
  }
  avatar: {
    color: string
    text: string
  }
  email: string
}

export interface AnzuUser extends AnzuUserAndTimeTrackingAware, Omit<AnzuUserMinimal, 'id'> {
  id?: IntegerIdNullable
  enabled: boolean
  roles: string[]
  permissionGroups: IntegerId[]
  permissions: Permissions
  resolvedPermissions: Permissions
  _resourceName: string
  _system: string
}
