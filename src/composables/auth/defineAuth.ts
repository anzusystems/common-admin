import { computed } from 'vue'
import { useAuthStore } from '@/composables/auth/authStore'
import { type AxiosInstance } from 'axios'
import type { AclValue } from '@/types/Permission'
import { isArray, isNull, isUndefined } from '@/utils/common'
import { objectGetValueByPath } from '@/utils/object'
import { Grant } from '@/model/valueObject/Grant'
import { isOwnerAware } from '@/types/OwnerAware'
import { isCreatedByAware } from '@/types/CreatedByAware'
import type { AnzuUser } from '@/types/AnzuUser'
import type { UrlParams } from '@/services/api/apiHelper'
import { apiFetchOne } from '@/services/api/apiFetchOne'

export type DefineAuthConfig = {
  adminRole: string | Array<{ system: string; adminRole: string }>
}

export const ROLE_SUPER_ADMIN = 'ROLE_SUPER_ADMIN'

const defaultConfig: DefineAuthConfig = {
  adminRole: ROLE_SUPER_ADMIN,
}

/**
 * @param mainCurrentUserSystem - By this system currentUser object is used to get user ID.
 * @param config
 */
export function defineAuth<TAclValue extends AclValue>(
  mainCurrentUserSystem: string,
  config: Partial<DefineAuthConfig> = {}
) {
  const mergedConfig = { ...defaultConfig, ...config }
  const authStore = useAuthStore()
  const { canHelper, canForAllHelper, canOwnerHelper, isAdminHelper } = useAuthHelpers()

  const isAdmin = (userRoles: string[], system: string) => {
    return isAdminHelper(userRoles, system)
  }

  const can = (acl: TAclValue, subject?: object) => {
    return canHelper(acl, subject)
  }

  function canOwner(subject: object) {
    return canOwnerHelper(subject, mainCurrentUserSystem)
  }

  const canForAll = (acls: TAclValue[], subject?: object) => {
    return canForAllHelper(acls, subject)
  }

  const canForSome = (acls: TAclValue[], subject?: object) => {
    if (acls.length === 0) {
      return true
    }
    return acls.some((acl) => {
      return can(acl, subject)
    })
  }

  const currentUserId = computed(() => {
    const user = authStore.getCurrentUserBySystem(mainCurrentUserSystem)
    const userIsLoaded = authStore.isCurrentUserLoadedBySystem(mainCurrentUserSystem)
    if (isUndefined(userIsLoaded)) {
      return undefined
    }
    if (isUndefined(user) || isUndefined(user.id) || isNull(user.id) || user.id === 0) {
      return undefined
    }
    return user.id
  })

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
        return isAdmin(currentUser.value.roles, system)
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

    const storeAdminRoleBySystem = () => {
      if (isArray(mergedConfig.adminRole)) {
        const found = mergedConfig.adminRole.find((role) => role.system === system)
        if (found) {
          authStore.isAdminRoleBySystem.value.set(system, found.adminRole)
        }
      } else {
        authStore.isAdminRoleBySystem.value.set(system, mergedConfig.adminRole)
      }
    }

    const fetchCurrentUser = async (
      client: () => AxiosInstance,
      endPoint = '/adm/v1/users/current',
      urlParams: UrlParams | undefined = undefined,
      entity = 'user'
    ) => {
      try {
        const res = await apiFetchOne<TCurrentUser>(client, endPoint, urlParams, system, entity)
        setCurrentUser(res)
        authStore.currentUsersLoaded.value.set(system, true)
        storeAdminRoleBySystem()
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
    canOwner,
    useCurrentUser,
    currentUserId,
    config: mergedConfig,
  }
}

export function useAuthHelpers<TAclValue extends AclValue>() {
  const authStore = useAuthStore()

  const canHelper = (acl: TAclValue, subject: object | undefined) => {
    const system = getSystemFromAcl(acl)
    const user = authStore.getCurrentUserBySystem(system)
    const userIsLoaded = authStore.isCurrentUserLoadedBySystem(system)
    if (isUndefined(userIsLoaded)) {
      throw new Error('Composable defineAuth must try to load currentUser first to use can function.')
    }
    if (isUndefined(user) || isUndefined(user.id) || isNull(user.id) || user.id === 0) {
      return false
    }
    if (isAdminHelper(user.roles, system)) return true
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
        return canOwnerHelper(subject, system)
      default:
        return false
    }
  }

  const canForAllHelper = (acls: TAclValue[], subject?: object) => {
    if (acls.length === 0) {
      return true
    }
    return acls.every((acl) => {
      return canHelper(acl, subject)
    })
  }

  const isAdminHelper = (userRoles: string[], system: string) => {
    const authStore = useAuthStore()
    const adminRole = authStore.getAdminRoleBySystem(system)
    if (isUndefined(adminRole)) return false

    return userRoles.includes(adminRole)
  }

  function canOwnerHelper(subject: object, system: string) {
    const user = authStore.getCurrentUserBySystem(system)
    const userIsLoaded = authStore.isCurrentUserLoadedBySystem(system)
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

  return {
    canHelper,
    canForAllHelper,
    canOwnerHelper,
    isAdminHelper,
  }
}

function getSystemFromAcl (acl: any) {
  const parts = acl.split('_')

  return parts[0]
}
