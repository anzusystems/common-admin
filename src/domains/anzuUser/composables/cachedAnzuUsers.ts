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
 * One cache per system, not one shared cache.
 * Each backend has its own user table. Ids agree across them, but a user may exist in only
 * one backend (sms-gateway system accounts). A shared table would draw such users as unknown.
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
    // A user missing from the table stays missing. Otherwise another
    // backend's system user would be requested on every page that shows it.
    { retryNotFound: false }
  )
}

/**
 * Users of one backend, read from its `/adm/v1/anzu-user`, for an admin without its own user cache for that backend.
 * Returns the same names as the admins' `useCachedUsers()`, so
 * it plugs into `createUserAndTimeTrackingFields` directly.
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
