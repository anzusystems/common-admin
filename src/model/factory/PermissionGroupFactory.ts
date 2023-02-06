import { dateTimeNow } from '@/utils/datetime'
import { PermissionGroup } from '@/types/PermissionGroup'

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
