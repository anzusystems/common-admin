import { defineCached } from '@/composables/system/defineCached'
import type { AxiosClientFn } from '@/labs/api/client'
import {
  PERMISSION_GROUP_ENDPOINT,
  PERMISSION_GROUP_ENTITY,
  usePermissionGroupApi,
} from '@/labs/permissionGroup/permissionGroupApi'
import type { IntegerId } from '@/types/common'
import type { PermissionGroup, PermissionGroupMinimal } from '@/types/PermissionGroup'

export interface CachedPermissionGroupsParams {
  client: AxiosClientFn
  system: string
  entity?: string
  endPoint?: string
}

type Registry = ReturnType<typeof buildRegistry>

/**
 * One cache per system, not one shared by all of them.
 *
 * Permission group ids are per system -- group 42 in weather and group 42 in blog are different
 * rows -- and the admins' caches were keyed by id alone. That was harmless while an admin only
 * ever talked to one backend, and stops being harmless the moment a cross-system page renders a
 * chip for both: whichever answered first won, and the other system's group was drawn under the
 * wrong title.
 */
const registries = new Map<string, Registry>()

const mapFullToMinimal = (permissionGroup: PermissionGroup): PermissionGroupMinimal => ({
  id: permissionGroup.id,
  title: permissionGroup.title,
  permissions: permissionGroup.permissions,
})

const mapIdToMinimal = (id: IntegerId): PermissionGroupMinimal => ({
  id,
  title: '',
  permissions: {},
})

const buildRegistry = (params: Required<CachedPermissionGroupsParams>) => {
  const { useFetchPermissionGroupListByIds } = usePermissionGroupApi(params)

  return defineCached<IntegerId, PermissionGroup, PermissionGroupMinimal>(
    mapFullToMinimal,
    mapIdToMinimal,
    async (ids: IntegerId[]) => {
      const { execute } = useFetchPermissionGroupListByIds()
      return execute(ids)
    }
  )
}

export const useCachedPermissionGroups = (params: CachedPermissionGroupsParams) => {
  const resolved = {
    client: params.client,
    system: params.system,
    entity: params.entity ?? PERMISSION_GROUP_ENTITY,
    endPoint: params.endPoint ?? PERMISSION_GROUP_ENDPOINT,
  }

  let registry = registries.get(resolved.system)
  if (!registry) {
    registry = buildRegistry(resolved)
    registries.set(resolved.system, registry)
  }

  const { cache, toFetch, fetch, immediateFetch, add, addManual, addManualMinimal, has, get, isLoaded, clear } =
    registry

  return {
    cachedPermissionGroups: cache,
    toFetchCachedPermissionGroups: toFetch,
    fetchCachedPermissionGroups: fetch,
    immediateFetchCachedPermissionGroups: immediateFetch,
    addToCachedPermissionGroups: add,
    addManualToCachedPermissionGroups: addManual,
    addManualMinimalToCachedPermissionGroups: addManualMinimal,
    hasCachedPermissionGroup: has,
    getCachedPermissionGroup: get,
    isLoadedCachedPermissionGroup: isLoaded,
    clearCachedPermissionGroups: clear,
  }
}

/** Test seam. Registries are module state and would otherwise leak between cases. */
export const resetCachedPermissionGroupRegistries = () => {
  registries.clear()
}
