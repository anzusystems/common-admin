import { beforeEach, describe, expect, it } from 'vitest'
import {
  permissionGroupFilterStorageKey,
  resetPermissionGroupListFilters,
  usePermissionGroupInnerFilter,
  usePermissionGroupListFilter,
} from '@/labs/permissionGroup/permissionGroupFilter'

// The per-admin versions kept one filter store at module scope, which was correct while an admin
// spoke to a single backend. admin-inhouse has four, and one shared store means a title typed in
// the weather list is the filter the brick list opens with.

beforeEach(() => {
  resetPermissionGroupListFilters()
})

describe('permission group list filter', () => {
  it('keeps one store per system', () => {
    const weather = usePermissionGroupListFilter('weather')
    const brick = usePermissionGroupListFilter('brick')

    weather.filterData.title = 'editors'

    expect(brick.filterData.title).toBeNull()
  })

  it('hands the same system back the store it typed into', () => {
    usePermissionGroupListFilter('weather').filterData.title = 'editors'

    expect(usePermissionGroupListFilter('weather').filterData.title).toBe('editors')
  })

  it('names storage per system, and never under the key the per-admin views use', () => {
    expect(permissionGroupFilterStorageKey('weather')).toBe('labsPermissionGroup_weather')
    expect(permissionGroupFilterStorageKey('brick')).not.toBe(permissionGroupFilterStorageKey('weather'))
    // What `useFilterHelpers` would derive on its own, and what the old views still store under
    // while both versions are on screen (rule 8.0).
    expect(permissionGroupFilterStorageKey('weather')).not.toBe('tableFilter_common_permissionGroup')
  })

  it('titles fields from the library namespace, not from the backend identity', () => {
    const { filterConfig } = usePermissionGroupListFilter('weather')

    expect(filterConfig.fields.title.titleT).toBe('common.permissionGroup.filter.title')
  })

  it('gives every autocomplete its own inner filter', () => {
    const first = usePermissionGroupInnerFilter()
    const second = usePermissionGroupInnerFilter()

    first.filterData.title = 'editors'

    expect(second.filterData.title).toBeNull()
  })
})
