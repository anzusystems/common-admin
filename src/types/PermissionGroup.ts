import type { IntegerId } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import { UserAndTimeTrackingFields } from '@/types/UserAndTimeTrackingFields'

export interface PermissionGroupMinimal {
  id: IntegerId
  title: string
  permissions: Permissions
}

export interface PermissionGroup extends PermissionGroupMinimal, UserAndTimeTrackingFields {
  description: string
  _system: string
  _resourceName: 'permissionGroup'
}
