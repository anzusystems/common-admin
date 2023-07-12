import { isDefined, isUndefined } from '@/utils/common'
import { objectGetValueByPath } from '@/utils/object'
import { Grant } from '@/model/valueObject/Grant'
import { isOwnerAware } from '@/types/OwnerAware'
import { isCreatedByAware } from '@/types/CreatedByAware'
import { inject } from 'vue'
import type { CurrentUserType, CustomAclResolver } from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/types/Permission'
import { CurrentUserSymbol, CustomAclResolverSymbol } from '@/components/injectionKeys'

export const ROLE_SUPER_ADMIN = 'ROLE_ADMIN'

export type AclResolverConfig = {
  disableInject?: true | undefined
  currentUser?: CurrentUserType
  customAclProvider?: CustomAclResolver
}

export function useAcl<T extends AclValue = AclValue>(options?: AclResolverConfig) {
  const shouldInject = isUndefined(options) || isUndefined(options.disableInject)
  const currentUser =
    options?.currentUser ??
    (shouldInject ? (inject(CurrentUserSymbol, undefined) as CurrentUserType | undefined) : undefined)
  const customAclProvider =
    options?.customAclProvider ??
    (shouldInject ? (inject(CustomAclResolverSymbol, undefined) as CustomAclResolver) : undefined)

  const can = (acl: T, subject?: object): boolean => {
    if (isUndefined(currentUser))
      throw new Error('Composable useAcl can be used as a global state without providing current user as a parameter.')
    if (isDefined(customAclProvider) && isDefined(customAclProvider.can)) return customAclProvider.can(acl, subject)
    if (isUndefined(currentUser.value) || currentUser.value.id === 0) return false
    if (currentUser.value.roles.includes(ROLE_SUPER_ADMIN)) return true
    const permission = objectGetValueByPath(currentUser.value, 'resolvedPermissions.' + acl)
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
    if (isUndefined(currentUser))
      throw new Error('Composable useAcl can be used as a global state without providing current user as a parameter.')
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
