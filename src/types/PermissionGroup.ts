import type { IntegerId } from '@/types/common'
import type { Permissions } from '@/types/Permission'
import { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export interface PermissionGroupMinimal {
  id: IntegerId
  title: string
  permissions: Permissions
}

export interface PermissionGroup extends PermissionGroupMinimal, AnzuUserAndTimeTrackingAware {
  description: string
  _system: string
  _resourceName: 'permissionGroup'
}
