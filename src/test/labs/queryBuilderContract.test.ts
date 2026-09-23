import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { apiGenerateListQuery } from '@/services/api/apiFetchList'
import { generateListQuery } from '@/labs/api/useApiFetchList'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import type { Pagination as PaginationLegacy } from '@/types/Pagination'
import type { Pagination } from '@/labs/filters/pagination'
import type { FilterBag } from '@/types/Filter'
import { reactive } from 'vue'

// The filter-to-query translation, on both sides of the migration.
//
// Nothing pinned this before: the list contract test runs a non-mandatory filter whose default is
// empty, so `getValue` answers null and not one `filter_*` is ever emitted. Every case here emits
// one, and asserts the WHOLE query string rather than `toContain` -- a `toContain` assertion is
// why a missing segment passed unnoticed.
//
// Both builders are exported, so there is no axios to mock. Each case builds the same filter twice,
// once in each model, and compares the two strings to each other as well as to the literal -- a
// divergence shows up as a failure on the side that moved. Only the labs builder is pure: the
// legacy one writes a mandatory default back into the bag it was handed, which is what case C pins,
// so each case hands it a bag of its own.

const legacyPagination = (over: Partial<PaginationLegacy> = {}): PaginationLegacy =>
  ({
    sortBy: null,
    descending: false,
    page: 1,
    rowsPerPage: 25,
    rowsNumber: 0,
    hasNextPage: null,
    currentViewCount: 0,
    totalCount: 0,
    ...over,
  }) as PaginationLegacy

const labsPagination = (over: Partial<Pagination> = {}) =>
  ref<Pagination>({
    sortBy: null,
    page: 1,
    rowsPerPage: 25,
    rowsNumber: 0,
    hasNextPage: null,
    currentViewCount: 0,
    totalCount: 0,
    ...over,
  } as Pagination)

const makeFilter = makeFilterHelper('sys', 'subj')

const labsFilter = <F extends readonly MakeFilterOption<any>[]>(fields: F, elastic = false) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj', elastic })
  return { filterData, filterConfig }
}

describe('filter to query, legacy and labs', () => {
  // `field` on the legacy side is `apiName` on the labs side, and the variant rides along into the
  // `filter_<variant>[...]` key. This is the DamUser shape -- the one bridge of the three where a
  // builder difference could actually surface, since the other two run elastic.
  it('A: names the api field and keeps the variant', () => {
    const bag = reactive({
      lastName: { ...makeFilter({ name: 'lastName', variant: 'startsWith', field: 'person.lastName' }) },
    }) as unknown as FilterBag
    bag.lastName.model = 'Nov'

    const fields = [
      { name: 'lastName', variant: 'startsWith', apiName: 'person.lastName', default: null },
    ] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = labsFilter(fields)
    ;(filterData as Record<string, unknown>).lastName = 'Nov'

    const expected = '?limit=25&offset=0&filter_startsWith[person.lastName]=Nov'
    expect(apiGenerateListQuery(legacyPagination(), bag)).toBe(expected)
    expect(generateListQuery(labsPagination(), filterData, filterConfig)).toBe(expected)
  })

  // Elastic is a flat `key=value` with no variant at all. On the legacy side it is triggered by the
  // mere PRESENCE of `_elastic` in the bag; on the labs side `createFilter` couples `elastic` to
  // `simpleFilters`. While it is on, the variant mismatch between the two models is invisible --
  // which is exactly why turning it off later is the dangerous edit.
  it('B: goes flat when elastic, dropping the variant', () => {
    const bag = reactive({
      _elastic: { ...makeFilter({ exclude: true }) },
      text: { ...makeFilter({ name: 'text' }) },
    }) as unknown as FilterBag
    bag.text.model = 'abc'

    const fields = [{ name: 'text', variant: 'search', default: null }] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = labsFilter(fields, true)
    ;(filterData as Record<string, unknown>).text = 'abc'

    const expected = '?limit=25&offset=0&text=abc'
    expect(apiGenerateListQuery(legacyPagination(), bag)).toBe(expected)
    expect(generateListQuery(labsPagination(), filterData, filterConfig)).toBe(expected)
  })

  // The one genuine behaviour change in the whole migration: both emit the default, but the legacy
  // builder WRITES it back into the filter it was handed -- so the UI shows a value the user never
  // typed -- and the labs one leaves the data alone.
  it('C: emits a mandatory default, and only the legacy builder writes it back', () => {
    const bag = reactive({
      status: { ...makeFilter({ name: 'status', mandatory: true, default: 'active' }) },
    }) as unknown as FilterBag
    bag.status.model = null

    const fields = [
      { name: 'status', mandatory: true, default: 'active' },
    ] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = labsFilter(fields)
    ;(filterData as Record<string, unknown>).status = null

    const expected = '?limit=25&offset=0&filter_eq[status]=active'
    expect(apiGenerateListQuery(legacyPagination(), bag)).toBe(expected)
    expect(bag.status.model).toBe('active')

    expect(generateListQuery(labsPagination(), filterData, filterConfig)).toBe(expected)
    expect((filterData as Record<string, unknown>).status).toBeNull()
  })

  // Same case with an array default, where the two disagree on the wire and not just in the model:
  // legacy hands the array back raw and lets string coercion join it, labs joins and encodes each
  // item. A value needing encoding is the only way to see it.
  it('C2: an array default is encoded by labs and handed back raw by legacy', () => {
    const bag = reactive({
      tags: { ...makeFilter({ name: 'tags', mandatory: true, default: ['a b', 'c'] }) },
    }) as unknown as FilterBag
    bag.tags.model = []

    const fields = [
      { name: 'tags', mandatory: true, default: ['a b', 'c'] },
    ] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = labsFilter(fields)
    ;(filterData as Record<string, unknown>).tags = []

    expect(apiGenerateListQuery(legacyPagination(), bag)).toBe('?limit=25&offset=0&filter_eq[tags]=a b,c')
    expect(generateListQuery(labsPagination(), filterData, filterConfig)).toBe(
      '?limit=25&offset=0&filter_eq[tags]=a%20b,c'
    )
  })

  // A key in the data with no entry in the config is dropped without a word. The legacy builder had
  // no such notion -- it iterated the bag itself, so every key in the bag reached the query.
  it('D: labs drops a data key that has no config entry', () => {
    const fields = [{ name: 'text', default: null }] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = labsFilter(fields)
    ;(filterData as Record<string, unknown>).text = 'abc'
    ;(filterData as Record<string, unknown>).ghost = 'x'

    expect(generateListQuery(labsPagination(), filterData, filterConfig)).toBe('?limit=25&offset=0&filter_eq[text]=abc')
  })

  // Page 1 is the first page in both models, but the legacy builder never clamped: a caller that
  // passes 0 gets a negative offset rather than the first page.
  it('E: only the labs builder clamps the offset', () => {
    const fields = [] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = labsFilter(fields)

    expect(apiGenerateListQuery(legacyPagination({ page: 0 }), reactive({}) as unknown as FilterBag)).toBe(
      '?limit=25&offset=-25'
    )
    expect(generateListQuery(labsPagination({ page: 0 }), filterData, filterConfig)).toBe('?limit=25&offset=0')
  })
})
