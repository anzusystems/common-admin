import { computed } from 'vue'
import { useAuthStore } from '@/composables/auth/authStore'
import { type AxiosInstance } from 'axios'
import type { AclValue } from '@/types/Permission'
import { isNull, isUndefined } from '@/utils/common'
import { objectGetValueByPath } from '@/utils/object'
import { Grant } from '@/model/valueObject/Grant'
import { isOwnerAware } from '@/types/OwnerAware'
import { isCreatedByAware } from '@/types/CreatedByAware'
import type { AnzuUser } from '@/types/AnzuUser'
import type { UrlParams } from '@/services/api/apiHelper'
import { apiFetchOne } from '@/services/api/apiFetchOne'

export const ROLE_SUPER_ADMIN = 'ROLE_SUPER_ADMIN'

/**
 * @param mainCurrentUserSystem - By this system currentUser object is used to get user ID.
 */
export function defineAuth<TAclValue extends AclValue>(mainCurrentUserSystem: string) {
  const authStore = useAuthStore()

  const getSystemFromAcl = (acl: TAclValue) => {
    const parts = acl.split('_')
    return parts[0]
  }

  const isAdmin = (userRoles: string[]) => {
    return userRoles.includes(ROLE_SUPER_ADMIN)
  }

  const can = (acl: TAclValue, subject?: object) => {
    const system = getSystemFromAcl(acl)
    const user = authStore.getCurrentUserBySystem(system)
    const userIsLoaded = authStore.isCurrentUserLoadedBySystem(system)
    if (isUndefined(userIsLoaded)) {
      throw new Error('Composable defineAuth must try to load currentUser first to use can function.')
    }
    if (isUndefined(user) || isUndefined(user.id) || isNull(user.id) || user.id === 0) {
      return false
    }
    if (isAdmin(user.roles)) return true
    const permission = objectGetValueByPath(user, 'resolvedPermissions.' + acl)
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
    const user = authStore.getCurrentUserBySystem(mainCurrentUserSystem)
    const userIsLoaded = authStore.isCurrentUserLoadedBySystem(mainCurrentUserSystem)
    if (isUndefined(userIsLoaded)) {
      throw new Error('Composable defineAuth must try to load currentUser first to use canOwner function.')
    }
    if (isUndefined(user) || isUndefined(user.id) || isNull(user.id) || user.id === 0) {
      return false
    }
    if (isOwnerAware(subject)) {
      return subject.owners.includes(user.id)
    }
    if (isCreatedByAware(subject)) {
      return subject.createdBy === user.id
    }
    return false
  }

  const canForAll = (acls: TAclValue[], subject?: object) => {
    if (acls.length === 0) {
      return true
    }
    return acls.every((acl) => {
      return can(acl, subject)
    })
  }

  const canForSome = (acls: TAclValue[], subject?: object) => {
    if (acls.length === 0) {
      return true
    }
    return acls.some((acl) => {
      return can(acl, subject)
    })
  }

  function useCurrentUser<TCurrentUser extends AnzuUser | undefined>(system: string) {
    const setCurrentUser = (user: TCurrentUser) => {
      authStore.currentUsers.value.set(system, user)
      authStore.currentUsersLoaded.value.set(system, true)
    }

    const currentUser = computed((): TCurrentUser | undefined => {
      return authStore.currentUsers.value.get(system) as TCurrentUser | undefined
    })

    const isCurrentUserLoaded = computed((): boolean | undefined => {
      return authStore.currentUsersLoaded.value.get(system) as boolean | undefined
    })

    const isSuperAdmin = computed(() => {
      if (currentUser.value) {
        return isAdmin(currentUser.value.roles)
      }
      return false
    })

    const hasCurrentUser = computed(() => {
      return currentUser.value ?? false
    })

    const isAnonymous = computed(() => {
      if (isUndefined(isCurrentUserLoaded.value)) return undefined
      return !hasCurrentUser.value
    })

    const fetchCurrentUser = async (
      client: () => AxiosInstance,
      endPoint = '/adm/v1/user/current',
      urlParams: UrlParams | undefined = undefined,
      entity = 'user'
    ) => {
      try {
        const res = await apiFetchOne<TCurrentUser>(client, endPoint, urlParams, system, entity)
        setCurrentUser(res)
        authStore.currentUsersLoaded.value.set(system, true)
        return currentUser.value
      } catch (error) {
        authStore.currentUsersLoaded.value.set(system, true)
        return undefined
      }
    }

    return {
      currentUser,
      setCurrentUser,
      isSuperAdmin,
      isAnonymous,
      hasCurrentUser,
      fetchCurrentUser,
    }
  }

  return {
    can,
    canForAll,
    canForSome,
    useCurrentUser,
  }
}
