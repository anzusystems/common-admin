import type { IntegerId, DatetimeUTC, IntegerIdNullable } from '@/types/common'
import type { Permissions } from '@/types/Permission'

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

export interface AnzuUserAndTimeTrackingAware extends AnzuUserCreatedByAware {
  createdAt: DatetimeUTC
  modifiedAt: DatetimeUTC
  modifiedBy: IntegerIdNullable
}

export interface AnzuUserCreatedByAware {
  createdBy: IntegerIdNullable
}

export const isAnzuUserCreatedByAware = (value: object): value is AnzuUserCreatedByAware => {
  return Object.hasOwn(value, 'createdBy')
}
