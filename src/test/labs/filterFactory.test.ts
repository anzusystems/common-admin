import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildFilterHash,
  createFilter,
  createFilterStore,
  isRouterSafeHash,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { SortOrder } from '@/composables/system/datatableColumns'
import { usePagination } from '@/labs/filters/pagination'
import { useDatatablePageStore } from '@/composables/system/datatablePageStore'

// A hash that lost its `~` marker used to be salvaged by dropping everything after the last `&`.
// Since `serializeFilters` appends `_sort` last, that removed precisely the sort, pagination got
// `sortBy: null`, and the list was then fetched without `order[...]` — with LIMIT/OFFSET and no
// ORDER BY, paging can repeat or skip rows. The broken hash stayed in the URL, so it survived
// reloads. `sortBy: null` remains legitimate for `usePagination(null)` tables, which is why the
// fix rejects unusable hashes instead of overriding the sort.

const fields = [
  { name: 'name', default: '' },
  { name: 'ids', default: [] as number[] },
] as const satisfies readonly MakeFilterOption<string>[]

// `useFilterHelpers` derives it from system/subject unless `storeFiltersLocalStorage`
// overrides it, so it is not the local-storage key.
const PAGE_STORE_KEY = 'sys_subj'

const setup = (moreOptions: Record<string, unknown> = {}, sortKey: string | null = 'id') => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, {
    system: 'sys',
    subject: 'subj',
  })
  const { pagination } = usePagination(sortKey)
  const helpers = useFilterHelpers(filterData, filterConfig, moreOptions)
  return { filterData, filterConfig, pagination, ...helpers }
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  window.location.hash = ''
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('deserializeFilters — end marker handling', () => {
  it('keeps filters and sort for a well-formed hash', () => {
    const { deserializeFilters } = setup()

    expect(deserializeFilters('#name=abc&_sort=id%2Cdesc~')).toEqual({
      filters: { name: 'abc' },
      sortBy: { key: 'id', order: 'desc' },
    })
  })

  it('rejects a hash without the end marker instead of dropping its last parameter', () => {
    const { deserializeFilters } = setup()

    // Used to yield sortBy: null; any last parameter was at risk, not just the sort.
    expect(deserializeFilters('#name=abc&_sort=id,desc')).toBeNull()
    expect(deserializeFilters('#name=abc&ids=1%2C2')).toBeNull()
  })

  it('rejects a foreign hash so the localStorage fallback stays reachable', () => {
    const { deserializeFilters } = setup()

    expect(deserializeFilters('#foo=1&bar=2')).toBeNull()
    expect(deserializeFilters('#section-3')).toBeNull()
  })

  it('rejects a marked hash that carries nothing usable', () => {
    const { deserializeFilters } = setup()

    expect(deserializeFilters('#~')).toBeNull()
    expect(deserializeFilters('#foo=1~')).toBeNull()
  })

  it('ignores anything appended after the marker', () => {
    const { deserializeFilters } = setup()

    expect(deserializeFilters('#name=abc~&utm=x')).toEqual({
      filters: { name: 'abc' },
      sortBy: null,
    })
  })

  it('does not split on a tilde inside a value, because it is percent-encoded', () => {
    const { serializeFilters, deserializeFilters, pagination } = setup()

    const serialized = serializeFilters({ name: 'a~b' }, pagination, true)
    expect(serialized).toContain('a%7Eb')

    const parsed = deserializeFilters(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.filters.name).toBe('a~b')
  })
})

describe('loadStoredFilters — sort survives', () => {
  it('leaves pagination untouched when the hash is corrupted', () => {
    const { pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc&_sort=id,desc'

    expect(loadStoredFilters(pagination)).toBe(false)
    expect(pagination.value.sortBy).toEqual({ key: 'id', order: 'desc' })
  })

  it('applies a well-formed hash', () => {
    const { pagination, filterData, loadStoredFilters } = setup()
    window.location.hash = '#name=abc&_sort=name%2Casc~'

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('abc')
    expect(pagination.value.sortBy).toEqual({ key: 'name', order: 'asc' })
  })

  it('falls back to localStorage when the hash is foreign', () => {
    const { pagination, filterData, loadStoredFilters } = setup()
    localStorage.setItem('tableFilter_sys_subj', 'name=stored&_sort=name%2Casc~')
    window.location.hash = '#foo=1&bar=2'

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('stored')
    expect(pagination.value.sortBy).toEqual({ key: 'name', order: 'asc' })
  })

  it('keeps a deliberately unsorted table unsorted', () => {
    const { pagination, filterData, loadStoredFilters } = setup({}, null)
    localStorage.setItem('tableFilter_sys_subj', 'name=stored~')

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('stored')
    expect(pagination.value.sortBy).toBeNull()
  })

  it('reports no stored state when both filters and sort are empty', () => {
    const { pagination, loadStoredFilters } = setup()

    expect(loadStoredFilters(pagination)).toBe(false)
    expect(pagination.value.sortBy).toEqual({ key: 'id', order: 'desc' })
  })
})

// Several datatables can share one system/subject — cms has seven for `cms/article` — and they
// tell themselves apart by overriding `storeFiltersLocalStorage`. The remembered page used to be
// keyed by system/subject alone, so the dashboard's article table handed its page to the main
// article list. The second case below is the detector: with the old key the override'd table read
// from `sys_subj` and got nothing. The first is a guard — it passes either way.
describe('loadStoredFilters — the remembered page is keyed per table', () => {
  const { setStoredPage, setPreservePage, consumeStoredPage } = useDatatablePageStore()
  const otherTableKey = 'tableFilter_sys_subj_personal'

  beforeEach(() => {
    consumeStoredPage(otherTableKey) // drain a flag left by a previous case
  })

  it('does not restore a page stored by another table of the same subject', () => {
    setStoredPage(otherTableKey, 4)
    setPreservePage()

    const { pagination, loadStoredFilters } = setup()
    loadStoredFilters(pagination)

    expect(pagination.value.page).toBe(1)
  })

  it('restores the page stored under its own override key', () => {
    setStoredPage(otherTableKey, 4)
    setPreservePage()

    const { pagination, loadStoredFilters } = setup({ storeFiltersLocalStorage: otherTableKey })
    loadStoredFilters(pagination)

    expect(pagination.value.page).toBe(4)
  })
})

// A url hash reaches a list from a link or from stepping back to an older address, and in both
// cases it describes the whole view. The fields it does not name used to keep whatever the
// module-level filter store still held, so the same link landed differently depending on whether
// the user pasted it into a fresh tab or clicked it inside the running app. Local storage keeps
// merging: there the absent fields were left out precisely because they equal their default.
describe('loadStoredFilters — a hash is authoritative', () => {
  it('resets fields the hash does not mention', () => {
    const { pagination, filterData, loadStoredFilters } = setup()
    filterData.name = 'left over from an earlier visit'
    filterData.ids = [7, 8]
    window.location.hash = '#name=abc~'

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('abc')
    expect(filterData.ids).toEqual([])
  })

  it('leaves a dirty store alone when the source is local storage', () => {
    const { pagination, filterData, loadStoredFilters } = setup()
    filterData.ids = [7, 8]
    localStorage.setItem('tableFilter_sys_subj', 'name=stored~')

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('stored')
    expect(filterData.ids).toEqual([7, 8])
  })

  // Unknown keys are dropped before the reset decides, so a hash meant for another table sharing
  // the page arrives here looking like a sort-only hash. Treating that as authoritative wiped the
  // filter of a table the link never addressed, and mirrored the empty result into local storage.
  it('does not reset anything for a hash carrying only a sort', () => {
    const { pagination, filterData, loadStoredFilters } = setup()
    filterData.name = 'mine'
    localStorage.setItem('tableFilter_sys_subj', 'name=mine~')
    window.location.hash = '#_sort=name,asc~'

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('mine')
    expect(pagination.value.sortBy).toEqual({ key: 'name', order: 'asc' })
    expect(localStorage.getItem('tableFilter_sys_subj')).toBe('name=mine~')
  })

  it('keeps the default sort when the hash carries none', () => {
    const { pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc~'

    loadStoredFilters(pagination)
    expect(pagination.value.sortBy).toEqual({ key: 'id', order: 'desc' })
  })

  it('starts a link on the first page', () => {
    const { setStoredPage } = useDatatablePageStore()
    // Stored, but no preserve flag: nobody asked to come back, so this is a plain link.
    setStoredPage(PAGE_STORE_KEY, 4)

    const { pagination, loadStoredFilters } = setup()
    pagination.value = { ...pagination.value, page: 4 }
    window.location.hash = '#name=abc~'
    loadStoredFilters(pagination)

    expect(pagination.value.page).toBe(1)
  })

  // The close button sets the preserve flag and pushes the address it left, hash included. Forcing
  // page 1 for every hash would send the user back to the top of a list they had paged through.
  it('still restores the page when the close button asked for it', () => {
    const { setStoredPage, setPreservePage } = useDatatablePageStore()
    setStoredPage(PAGE_STORE_KEY, 4)
    setPreservePage()

    const { pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc~'
    loadStoredFilters(pagination)

    expect(pagination.value.page).toBe(4)
  })

  it('drains the preserve flag so the next list does not inherit the page', () => {
    const { setStoredPage, setPreservePage, consumeStoredPage } = useDatatablePageStore()
    setStoredPage(PAGE_STORE_KEY, 4)
    setPreservePage()

    const { pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc~'
    loadStoredFilters(pagination)

    expect(consumeStoredPage(PAGE_STORE_KEY)).toBeNull()
  })

  it('mirrors a hash-sourced view into local storage, without the values that equal a default', () => {
    const { pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc~'
    loadStoredFilters(pagination)

    expect(localStorage.getItem('tableFilter_sys_subj')).toBe('name=abc&_sort=id,desc~')
  })
})

describe('buildFilterHash', () => {
  const config = () =>
    createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'subj' }).filterConfig

  it('leaves out values equal to their default, arrays compared by content', () => {
    expect(buildFilterHash(config(), { name: '', ids: [] })).toBe('')
  })

  it('encodes what a url fragment accepts verbatim, so router.push keeps it intact', () => {
    const hash = buildFilterHash(
      config(),
      { name: '2025-09-08T22:00:00.000000Z', ids: [1, 2, 3] },
      { key: 'id', order: SortOrder.Desc },
    )

    expect(hash).toBe('#name=2025-09-08T22:00:00.000000Z&ids=1,2,3&_sort=id,desc~')
    expect(isRouterSafeHash(hash)).toBe(true)
    // vue-router runs encodeURI over the hash; anything it changes is lost on the way.
    expect(encodeURI(hash)).toBe(hash)
    // ... and it glues a hash without the leading `#` straight onto the path.
    expect(hash.startsWith('#')).toBe(true)
  })

  it('keeps the end marker encoded inside a value', () => {
    const hash = buildFilterHash(config(), { name: 'a~b' })

    expect(hash).toBe('#name=a%7Eb~')
    expect(isRouterSafeHash(hash)).toBe(false)
  })

  it('round-trips through deserializeFilters', () => {
    const { deserializeFilters } = setup()
    const hash = buildFilterHash(config(), { ids: [1, 2] }, { key: 'name', order: SortOrder.Asc })

    expect(deserializeFilters(hash)).toEqual({
      filters: { ids: [1, 2] },
      sortBy: { key: 'name', order: 'asc' },
    })
  })
})

// `cloneDeep` is `structuredClone`, so an array default never compares `===` to its own copy and
// used to be written into the url on every submit.
describe('getFilterDataForStoring — array defaults', () => {
  const withArrayDefault = [
    { name: 'ids', default: [3] as number[] },
  ] as const satisfies readonly MakeFilterOption<string>[]

  it('omits an array still equal to its default', () => {
    const store = createFilterStore(withArrayDefault)
    const { filterData, filterConfig } = createFilter(withArrayDefault, store, {
      system: 'sys',
      subject: 'arr',
    })
    const { pagination } = usePagination(null)
    const { submitFilter } = useFilterHelpers(filterData, filterConfig)

    submitFilter(pagination)
    expect(localStorage.getItem('tableFilter_sys_arr')).toBe('')

    filterData.ids = [3, 4]
    submitFilter(pagination)
    expect(localStorage.getItem('tableFilter_sys_arr')).toBe('ids=3,4~')
  })
})
