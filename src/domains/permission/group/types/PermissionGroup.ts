import type { IntegerId } from '@/shared/types/common'
import type { Permissions } from '@/domains/auth/types/Permission'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'

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
