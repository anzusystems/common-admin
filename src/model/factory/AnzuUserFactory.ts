import { dateTimeNow } from '@/utils/datetime'
import { isString } from '@/utils/common'
import type { AnzuUser } from '@/types/AnzuUser'

export function useAnzuUserFactory(system = '', resourceName = 'user') {
  let _system = system
  let _resourceName = resourceName
  const createAnzuUser = (system?: string, resourceName?: string): AnzuUser => {
    if (isString(system)) _system = system
    if (isString(resourceName)) _resourceName = resourceName

    return {
      id: 0,
      createdAt: dateTimeNow(),
      createdBy: 0,
      email: '',
      enabled: false,
      modifiedAt: dateTimeNow(),
      modifiedBy: 0,
      permissionGroups: [],
      permissions: {},
      resolvedPermissions: {},
      roles: [],
      _system: _system,
      _resourceName: _resourceName
    }
  }

  return {
    createAnzuUser,
  }
}
