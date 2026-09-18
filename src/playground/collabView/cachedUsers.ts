import type { AnzuUser, AnzuUserMinimal } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { cmsClient } from '@/playground/mock/cmsClient'

export const fetchUserListByIds = (ids: number[]) => {
  const { executeFetch } = useApiFetchByIds<AnzuUser[]>({
    client: cmsClient,
    system: 'cms',
    entity: 'user',
    urlTemplate: '/adm/v1/user',
  })

  return executeFetch(ids)
}

export const mapFullToMinimal = (source: AnzuUser): AnzuUserMinimal => {
  return {
    id: source.id ?? 0,
    email: source.email,
    avatar: source.avatar,
    person: source.person,
  }
}

const mapIdToMinimal = (id: IntegerId): AnzuUserMinimal => {
  return {
    id: id,
    email: '',
    person: { firstName: '', lastName: '', fullName: '' },
    avatar: { color: '', text: '' },
  }
}

const { cache, fetch, add, addManual, has, get, isLoaded, addManualMinimal } = defineCached<
  IntegerId,
  AnzuUser,
  AnzuUserMinimal
>(mapFullToMinimal, mapIdToMinimal, fetchUserListByIds)

export const useCachedUsers = () => {
  return {
    addManualToCachedUsers: addManual,
    addManualMinimalToCachedUsers: addManualMinimal,
    addToCachedUsers: add,
    fetchCachedUsers: fetch,
    cachedUsers: cache,
    hasCachedUser: has,
    getCachedUser: get,
    isLoadedCachedUser: isLoaded,
  }
}
