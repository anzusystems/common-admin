import { beforeEach, describe, expect, it } from 'vitest'
import type { MakeFilterOption } from '@/labs/filters/filterFactory'
import { resetAnzuUserListFilters, useAnzuUserListFilter } from '@/labs/anzuUser/anzuUserFilter'

// The shared list carries three fields, and the two admins with the biggest lists need more than
// three. What stops those extras living in the shared list is that the same question is a different
// query per backend: cms asks for permission groups with `memberOf`, dam with `custom`.

const damExtras = [
  { name: 'lastName' as const, default: null, type: 'string', variant: 'startsWith', apiName: 'person.lastName' },
  { name: 'permissionGroups' as const, default: [], type: 'string', variant: 'custom' },
] satisfies readonly MakeFilterOption[]

const cmsExtras = [
  { name: 'allowedSites' as const, variant: 'memberOf', default: [] },
  { name: 'permissionGroups' as const, variant: 'memberOf', default: [] },
] satisfies readonly MakeFilterOption[]

beforeEach(() => {
  resetAnzuUserListFilters()
})

describe('the shared user list filter', () => {
  it('still gives every system the three fields on its own', () => {
    const { filterConfig } = useAnzuUserListFilter('weather')

    expect(Object.keys(filterConfig.fields)).toEqual(['id', 'email', 'enabled'])
  })

  it('adds what the system asks for, with the query that backend wants', () => {
    const { filterConfig } = useAnzuUserListFilter('dam', damExtras)

    expect(Object.keys(filterConfig.fields)).toContain('lastName')
    // `person.lastName`, not `lastName`: the column the backend filters on is nested.
    expect(filterConfig.fields.lastName.apiName).toBe('person.lastName')
    expect(filterConfig.fields.permissionGroups.variant).toBe('custom')
  })

  it('keeps the same field apart when two systems ask it differently', () => {
    const dam = useAnzuUserListFilter('dam', damExtras)
    const cms = useAnzuUserListFilter('cms', cmsExtras)

    expect(dam.filterConfig.fields.permissionGroups.variant).toBe('custom')
    expect(cms.filterConfig.fields.permissionGroups.variant).toBe('memberOf')
  })

  it('does not hand a system a value another system typed', () => {
    // One store per system, as before. Sharing one would carry `allowedSites` into a list that
    // cannot clear it, because that list does not draw the field.
    const cms = useAnzuUserListFilter('cms', cmsExtras)
    cms.filterData.allowedSites = [7]

    const weather = useAnzuUserListFilter('weather')
    const cmsAgain = useAnzuUserListFilter('cms', cmsExtras)

    expect(Object.keys(weather.filterData)).not.toContain('allowedSites')
    // And the same list gets its own value back rather than a fresh store.
    expect(cmsAgain.filterData.allowedSites).toEqual([7])
  })
})
