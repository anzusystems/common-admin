import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { ANZU_USER_ENTITY } from '@/domains/anzuUser/api/anzuUserApi'

const anzuUserListFields = [
  { name: 'id' as const, default: null, type: 'integer' },
  { name: 'email' as const, variant: 'startsWith', default: null, type: 'string', render: { skip: true } },
  { name: 'enabled' as const, default: null, type: 'boolean' },
] satisfies readonly MakeFilterOption[]

type ListFields = typeof anzuUserListFields

/**
 * One store per system; see the note in `permissionGroupFilter`.
 */
const listStores = new Map<string, FilterData<readonly MakeFilterOption[]>>()

export const anzuUserFilterStorageKey = (system: string) => `commonAnzuUser_${system}`

/**
 * Common fields plus per-system extras.
 * Extras are a parameter because backends differ: cms filters groups
 * with `memberOf`, dam with `custom`, and only cms has `allowedSites`.
 * Extra fields render automatically; a custom widget goes through the matching slot.
 */
export function useAnzuUserListFilter<E extends readonly MakeFilterOption[] = []>(
  system: string,
  extraFields?: E
): {
  filterConfig: FilterConfig<readonly [...ListFields, ...E]>
  filterData: FilterData<readonly [...ListFields, ...E]>
} {
  const extras = (extraFields ?? []) as readonly MakeFilterOption[]
  const fields = [...anzuUserListFields, ...extras] as unknown as readonly [...ListFields, ...E]
  // Extras are part of the store key. A shared store would carry a value the other list cannot clear.
  const key = [system, ...extras.map((field) => field.name)].join('|')

  let store = listStores.get(key)
  if (!store) {
    store = createFilterStore(fields) as FilterData<readonly MakeFilterOption[]>
    listStores.set(key, store)
  }

  const { filterConfig, filterData } = createFilter(fields, store as FilterData<readonly [...ListFields, ...E]>, {
    system: 'common',
    subject: ANZU_USER_ENTITY,
  })

  return { filterConfig, filterData }
}

/**
 * Exact e-mail match for cross-system search.
 * `startsWith` would match `jozko@sme.sk` to `jozko.mrkvicka@sme.sk` and report the wrong identity.
 */
export function useAnzuUserEmailLookupFilter() {
  const fields = [
    { name: 'email' as const, variant: 'eq', default: null, type: 'string' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(fields, createFilterStore(fields), {
    system: 'common',
    subject: ANZU_USER_ENTITY,
  })

  return { filterConfig, filterData }
}

/**
 * Test seam; the list stores are module state.
 */
export const resetAnzuUserListFilters = () => {
  listStores.clear()
}
