import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { DamUser } from '@/domains/dam/user/types/DamUser'
import type { IntegerId } from '@/shared/types/common'
import { defineCached } from '@/domains/cached/composables/defineCached'
import { fetchDamUserListByIds } from '@/domains/dam/user/api/userApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { checkDamConfigName, inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

const mapFullToMinimal = (source: DamUser): AnzuUserMinimal => {
  return { id: source.id, email: source.email, avatar: source.avatar, person: source.person }
}

const mapIdToMinimal = (id: IntegerId): AnzuUserMinimal => {
  return {
    id: id,
    email: '',
    person: { firstName: '', lastName: '', fullName: '' },
    avatar: { color: '', text: '' },
  }
}

// User cache per DAM configuration. It uses that configuration's client and `endPointUser`.
const defineCachedUsers = (configName: string) =>
  defineCached<IntegerId, DamUser, AnzuUserMinimal>(
    mapFullToMinimal,
    mapIdToMinimal,
    (ids: IntegerId[]) => {
      const { damClient, endPointUser } = useCommonAdminCoreDamOptions(configName)
      return fetchDamUserListByIds(damClient, ids, endPointUser)
    },
    'id',
    1000,
    // A user missing from the table is not requested again on every page that shows it.
    { retryNotFound: false }
  )

// One cache per configuration name, created on first use. The `default` one is created with the module.
const caches = new Map([['default', defineCachedUsers('default')]])

/**
 * User cache of the DAM configuration `configName`.
 * Without a name, uses the inherited one during component setup,
 * render or a lifecycle hook (not after an `await`), else `default`.
 * After the plugin sets options, an unknown configuration throws
 * on every call. Before that, the first request checks it.
 */
export const useDamCachedUsers = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // Checked on every call: options set again (a test, a hot update) may have removed the name.
  checkDamConfigName(name)
  let named = caches.get(name)
  if (!named) {
    named = defineCachedUsers(name)
    caches.set(name, named)
  }
  const { cache, fetch, add, addManual, has, get, isLoaded } = named
  return {
    addManualToCachedUsers: addManual,
    addToCachedUsers: add,
    fetchCachedUsers: fetch,
    cachedUsers: cache,
    hasCachedUser: has,
    getCachedUser: get,
    isLoadedCachedUser: isLoaded,
  }
}
