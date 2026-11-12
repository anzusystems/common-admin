import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { PERMISSION_GROUP_ENTITY } from '@/domains/permission/group/api/permissionGroupApi'

const permissionGroupListFields = [
  { name: 'id' as const, default: null, type: 'integer' },
  { name: 'title' as const, variant: 'startsWith', default: null, type: 'string', render: { skip: true } },
] satisfies readonly MakeFilterOption[]

type ListFields = typeof permissionGroupListFields

/**
 * One filter store per system. admin-inhouse has four backends, and a shared
 * store would carry a title typed under `weather` into the `brick` list.
 */
const listStores = new Map<string, FilterData<ListFields>>()

/**
 * Local-storage key for the list filter. Named so it does not collide with the replaced
 * per-admin views' `tableFilter_common_permissionGroup` key while both are in use.
 */
export const permissionGroupFilterStorageKey = (system: string) => `commonPermissionGroup_${system}`

export function usePermissionGroupListFilter(system: string): {
  filterConfig: FilterConfig<ListFields>
  filterData: FilterData<ListFields>
} {
  let store = listStores.get(system)
  if (!store) {
    store = createFilterStore(permissionGroupListFields)
    listStores.set(system, store)
  }

  // `system: 'common'` is the translation namespace, not the backend.
  // Labels live in `common.permissionGroup.filter.*` for every backend.
  // The backend identity keys the store above.
  const { filterConfig, filterData } = createFilter(permissionGroupListFields, store, {
    system: 'common',
    subject: PERMISSION_GROUP_ENTITY,
  })

  return { filterConfig, filterData }
}

export function usePermissionGroupInnerFilter() {
  // `title` is the autocomplete's `filter-by-field`. Built per call and never
  // registered: two autocompletes on a page must not type into each other.
  const innerFields = [
    { name: 'title' as const, variant: 'startsWith', default: null, type: 'string' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(innerFields, createFilterStore(innerFields), {
    system: 'common',
    subject: PERMISSION_GROUP_ENTITY,
  })

  return { filterConfig, filterData }
}

/** Test seam; the list stores are module state. */
export const resetPermissionGroupListFilters = () => {
  listStores.clear()
}
