import { dateTimeNow } from '@/shared/utils/datetime'
import type { PermissionGroup } from '@/domains/permission/group/types/PermissionGroup'

export function usePermissionGroupFactory() {
  const createPermissionGroup = (): PermissionGroup => {
    return {
      id: 0,
      title: '',
      description: '',
      permissions: {},
      createdBy: 0,
      modifiedBy: 0,
      createdAt: dateTimeNow(),
      modifiedAt: dateTimeNow(),
      _resourceName: 'permissionGroup',
      _system: '',
    }
  }

  return {
    createPermissionGroup,
  }
}
