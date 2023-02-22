import { isDefined, isUndefined } from '@/utils/common'
import { getValueByPath } from '@/utils/object'
import { Grant } from '@/model/valueObject/Grant'
import { isOwnerAware } from '@/types/OwnerAware'
import { isCreatedByAware } from '@/types/CreatedByAware'
import { inject } from 'vue'
import {
  CurrentUserSymbol,
  CurrentUserType,
  CustomAclResolver,
  CustomAclResolverSymbol
} from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/types/Permission'

export const ROLE_SUPER_ADMIN = 'ROLE_ADMIN'

export function useAcl<T extends AclValue = AclValue>() {
  const currentUser = inject(CurrentUserSymbol) as CurrentUserType
  const customAclProvider = inject(CustomAclResolverSymbol) as CustomAclResolver

  const can = (acl: T, subject?: object): boolean => {
    if (isDefined(customAclProvider) && isDefined(customAclProvider.can)) return customAclProvider.can(acl, subject)
    if (isUndefined(currentUser.value) || currentUser.value.id === 0) return false
    if (currentUser.value.roles.includes(ROLE_SUPER_ADMIN)) return true
    const permission = getValueByPath(currentUser.value, 'resolvedPermissions.' + acl)
    if (isUndefined(permission)) return false
    switch (permission) {
      case Grant.Allow:
        return true
      case Grant.Deny:
        return false
      case Grant.AllowOwner:
        if (isUndefined(subject))
          throw new Error(`Required subject for acl "${acl}" to determine an ability to access the resource.`)
        return canOwner(subject)
      default:
        return false
    }
  }

  function canOwner(subject: object) {
    if (!isUndefined(customAclProvider) && !isUndefined(customAclProvider.canOwner))
      return customAclProvider.canOwner(subject)
    if (currentUser.value) {
      if (isOwnerAware(subject)) {
        return subject.owners.includes(currentUser.value.id)
      }
      if (isCreatedByAware(subject)) {
        return subject.createdBy === currentUser.value.id
      }
    }
    return false
  }

  const canForAll = (acls: T[], subject?: object): boolean => {
    if (acls.length === 0) {
      return true
    }
    return acls.every((acl) => {
      return can(acl, subject)
    })
  }

  const canForSome = (acls: T[], subject?: object): boolean => {
    if (acls.length === 0) {
      return true
    }
    return acls.some((acl) => {
      return can(acl, subject)
    })
  }

  return {
    can,
    canForAll,
    canForSome,
  }
}
