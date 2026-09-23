import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { ANZU_USER_ENTITY } from '@/labs/anzuUser/anzuUserApi'

const anzuUserListFields = [
  { name: 'id' as const, default: null, type: 'integer' },
  { name: 'email' as const, variant: 'startsWith', default: null, type: 'string', render: { skip: true } },
  { name: 'enabled' as const, default: null, type: 'boolean' },
] satisfies readonly MakeFilterOption[]

type ListFields = typeof anzuUserListFields

/** One store per system; see the note in `permissionGroupFilter`. */
const listStores = new Map<string, FilterData<readonly MakeFilterOption[]>>()

export const anzuUserFilterStorageKey = (system: string) => `labsAnzuUser_${system}`

/**
 * The three fields every system has, plus whatever that system adds.
 *
 * The extras are a parameter rather than fields in the list above because the same filter is not
 * the same query everywhere: cms asks for permission groups with `memberOf` and dam with `custom`,
 * and cms has `allowedSites`, which exists nowhere else. Hard-coding either variant would send the
 * wrong query to the other backend, and leaving them out costs those two lists filters they have
 * today.
 *
 * `AFilterWrapper` draws any field that is not `render.skip` by itself, so a plain extra field
 * needs nothing else; one that wants its own widget -- a remote autocomplete -- is passed through
 * the matching slot.
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
  // The extras are part of the identity: one list asking for `allowedSites` and another that does
  // not are two different stores, and sharing one would carry a value the second cannot clear.
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
 * Exact match on e-mail, for the cross-system search.
 *
 * `startsWith` -- what the list filter uses and what admin-inhouse's search used -- cannot answer
 * the question that search asks. "Is this person here under this address" has to be `eq`, or
 * `jozko@sme.sk` matches `jozko.mrkvicka@sme.sk` and the fan-out reports the wrong identity.
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

/** Test seam; the list stores are module state. */
export const resetAnzuUserListFilters = () => {
  listStores.clear()
}
