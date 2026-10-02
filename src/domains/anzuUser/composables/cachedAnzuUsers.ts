import { defineCached } from '@/domains/cached/composables/defineCached'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import { ANZU_USER_ENDPOINT, ANZU_USER_ENTITY, useAnzuUserApi } from '@/domains/anzuUser/api/anzuUserApi'
import type { IntegerId } from '@/shared/types/common'
import type { AnzuUser, AnzuUserMinimal } from '@/shared/types/AnzuUser'

export interface CachedAnzuUsersParams {
  client: AxiosClientFn
  system: string
  entity?: string
  endPoint?: string
}

type Registry = ReturnType<typeof buildRegistry>

/**
 * One cache per system, not one shared by all of them.
 *
 * Every backend keeps its own user table. Ids come from the central login and agree across them, but
 * a user who exists in one backend need not exist in another -- the system accounts of sms-gateway
 * live only there. An admin over several backends that resolved all of them against one table would
 * draw some users as unknown, which is what admin-inhouse did with the weather cache.
 */
const registries = new Map<string, Registry>()

const mapFullToMinimal = (user: AnzuUser): AnzuUserMinimal => ({
  id: user.id ?? 0,
  email: user.email,
  person: user.person,
  avatar: user.avatar,
})

const mapIdToMinimal = (id: IntegerId): AnzuUserMinimal => ({
  id,
  email: '',
  person: { firstName: '', lastName: '', fullName: '' },
  avatar: { color: '', text: '' },
})

const buildRegistry = (params: Required<CachedAnzuUsersParams>) => {
  const { useFetchAnzuUserListByIds } = useAnzuUserApi(params)

  return defineCached<IntegerId, AnzuUser, AnzuUserMinimal>(
    mapFullToMinimal,
    mapIdToMinimal,
    (ids: IntegerId[]) => useFetchAnzuUserListByIds().execute(ids),
    'id',
    1000,
    // A user missing from the table stays missing: a system user of another backend would otherwise
    // be asked for on every page that shows it.
    { retryNotFound: false }
  )
}

/**
 * Users of one backend, read from its `/adm/v1/anzu-user` (every backend has it), for an admin that has
 * no user cache of its own for that backend. Returns the names the admins' own `useCachedUsers()` use,
 * so it plugs into `createUserAndTimeTrackingFields` as it is.
 */
export const useCachedAnzuUsers = (params: CachedAnzuUsersParams) => {
  const resolved = {
    client: params.client,
    system: params.system,
    entity: params.entity ?? ANZU_USER_ENTITY,
    endPoint: params.endPoint ?? ANZU_USER_ENDPOINT,
  }

  let registry = registries.get(resolved.system)
  if (!registry) {
    registry = buildRegistry(resolved)
    registries.set(resolved.system, registry)
  }

  const { cache, fetch, immediateFetch, add, addManual, addManualMinimal, has, get, isLoaded, clear } = registry

  return {
    cachedUsers: cache,
    fetchCachedUsers: fetch,
    immediateFetchCachedUsers: immediateFetch,
    addToCachedUsers: add,
    addManualToCachedUsers: addManual,
    addManualMinimalToCachedUsers: addManualMinimal,
    hasCachedUser: has,
    getCachedUser: get,
    isLoadedCachedUser: isLoaded,
    clearCachedUsers: clear,
  }
}

/** Test seam. Registries are module state and would otherwise leak between cases. */
export const resetCachedAnzuUserRegistries = () => {
  registries.clear()
}
