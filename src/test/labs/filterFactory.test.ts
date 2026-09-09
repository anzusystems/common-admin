import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFilter,
  createFilterStore,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
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
