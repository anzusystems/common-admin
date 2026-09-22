import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { PERMISSION_GROUP_ENTITY } from '@/labs/permissionGroup/permissionGroupApi'

const permissionGroupListFields = [
  { name: 'id' as const, default: null, type: 'integer' },
  { name: 'title' as const, variant: 'startsWith', default: null, type: 'string', render: { skip: true } },
] satisfies readonly MakeFilterOption[]

type ListFields = typeof permissionGroupListFields

/**
 * One filter store per system.
 *
 * The admins kept theirs at module scope, which is correct while an admin has a single backend and
 * wrong here: admin-inhouse has four, and a shared store would carry a title typed under `weather`
 * straight into the `brick` list.
 */
const listStores = new Map<string, FilterData<ListFields>>()

/**
 * Local-storage key for the list filter. Named rather than derived so it cannot collide with the
 * per-admin views this replaces, which store under `tableFilter_common_permissionGroup`; while
 * both versions are on screen they must not share remembered filters (rule 8.0).
 */
export const permissionGroupFilterStorageKey = (system: string) => `labsPermissionGroup_${system}`

export function usePermissionGroupListFilter(system: string): {
  filterConfig: FilterConfig<ListFields>
  filterData: FilterData<ListFields>
} {
  let store = listStores.get(system)
  if (!store) {
    store = createFilterStore(permissionGroupListFields)
    listStores.set(system, store)
  }

  // `system: 'common'` is the translation namespace, not the backend: the labels live in the
  // library's own `common.permissionGroup.filter.*` and are the same text whichever backend the
  // rows came from. The backend identity is what keys the store above.
  const { filterConfig, filterData } = createFilter(permissionGroupListFields, store, {
    system: 'common',
    subject: PERMISSION_GROUP_ENTITY,
  })

  return { filterConfig, filterData }
}

export function usePermissionGroupInnerFilter() {
  // `title` is the autocomplete's `filter-by-field`. Built per call and never registered: an
  // autocomplete's filter is scratch state for one open menu, and two of them on a page must not
  // type into each other.
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
