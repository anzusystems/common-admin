import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { DamUser } from '@/domains/dam/user/types/DamUser'
import type { IntegerId } from '@/shared/types/common'
import { defineCached } from '@/domains/cached/composables/defineCached'
import { fetchDamUserListByIds } from '@/domains/dam/user/api/userApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'

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

const { cache, fetch, add, addManual, has, get, isLoaded } = defineCached<IntegerId, DamUser, AnzuUserMinimal>(
  mapFullToMinimal,
  mapIdToMinimal,
  (ids: IntegerId[]) => {
    const { damClient } = useCommonAdminCoreDamOptions()
    return fetchDamUserListByIds(damClient, ids)
  }
)

export const useDamCachedUsers = () => {
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
