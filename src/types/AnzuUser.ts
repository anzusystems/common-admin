import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export interface BaseUser {
  id?: IntegerIdNullable
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
}

export interface AnzuUserMinimal extends BaseUser {
  id: IntegerId
}

export interface AnzuUser extends AnzuUserAndTimeTrackingAware, BaseUser {
  enabled: boolean
  roles: string[]
  permissionGroups: IntegerId[]
  permissions: Permissions
  resolvedPermissions: Permissions
  _resourceName: string
  _system: string
}
