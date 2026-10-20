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

// The cache of the users of a DAM configuration: it asks with that configuration's client, at its `endPointUser`.
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
    // A user missing from the table stays missing, instead of being asked for on every page showing it.
    { retryNotFound: false }
  )

// One cache per configuration name, made when the name is first asked for; that of `default` with the module.
const caches = new Map([['default', defineCachedUsers('default')]])

/**
 * The cache of the users of the DAM configuration `configName`.
 * A name left out is the inherited one while a component sets up, renders or runs a lifecycle hook (not after an
 * `await` there), else `default`. Once the plugin has set the options, a configuration the application has not got
 * throws on every call and gets no cache; a name asked for before that gets one, and its first request checks it.
 */
export const useDamCachedUsers = (configName?: string) => {
  const name = inheritedDamConfigName(configName)
  // On every call: options set again (a test, a hot update) may have left the name out.
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
