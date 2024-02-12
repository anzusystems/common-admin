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
      id: null,
      email: '',
      avatar: {
        color: '',
        text: '',
      },
      person: {
        firstName: '',
        fullName: '',
        lastName: '',
      },
      enabled: false,
      permissionGroups: [],
      permissions: {},
      resolvedPermissions: {},
      roles: [],
      modifiedAt: dateTimeNow(),
      modifiedBy: null,
      createdAt: dateTimeNow(),
      createdBy: null,
      _system: _system,
      _resourceName: _resourceName,
    }
  }

  return {
    createAnzuUser,
  }
}
