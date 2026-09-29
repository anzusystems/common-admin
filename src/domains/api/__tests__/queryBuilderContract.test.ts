import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { generateListQuery } from '@/domains/api/composables/useApiFetchList'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import type { Pagination } from '@/domains/api/composables/pagination'

// The filter-to-query translation.
//
// Nothing else pins it: the list contract test runs a non-mandatory filter whose default is empty,
// so `getValue` answers null and not one `filter_*` is ever emitted. Every case here emits one, and
// asserts the WHOLE query string rather than `toContain` -- a `toContain` assertion is why a missing
// segment passed unnoticed. The builder is exported and pure, so there is no axios to mock.

const pagination = (over: Partial<Pagination> = {}) =>
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

const filter = <F extends readonly MakeFilterOption<any>[]>(fields: F, elastic = false) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj', elastic })
  return { filterData, filterConfig }
}

describe('filter to query', () => {
  // The variant rides along into the `filter_<variant>[...]` key, under the api name.
  it('A: names the api field and keeps the variant', () => {
    const fields = [
      { name: 'lastName', variant: 'startsWith', apiName: 'person.lastName', default: null },
    ] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = filter(fields)
    ;(filterData as Record<string, unknown>).lastName = 'Nov'

    expect(generateListQuery(pagination(), filterData, filterConfig)).toBe(
      '?limit=25&offset=0&filter_startsWith[person.lastName]=Nov'
    )
  })

  // Elastic is a flat `key=value` with no variant at all: `createFilter` couples `elastic` to
  // `simpleFilters`. While it is on, a wrong variant is invisible -- which is exactly why turning it
  // off later is the dangerous edit.
  it('B: goes flat when elastic, dropping the variant', () => {
    const fields = [{ name: 'text', variant: 'search', default: null }] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = filter(fields, true)
    ;(filterData as Record<string, unknown>).text = 'abc'

    expect(generateListQuery(pagination(), filterData, filterConfig)).toBe('?limit=25&offset=0&text=abc')
  })

  // A mandatory default is emitted, and the filter data is left alone: the UI does not show a value
  // the user never typed.
  it('C: emits a mandatory default without writing it back', () => {
    const fields = [
      { name: 'status', mandatory: true, default: 'active' },
    ] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = filter(fields)
    ;(filterData as Record<string, unknown>).status = null

    expect(generateListQuery(pagination(), filterData, filterConfig)).toBe(
      '?limit=25&offset=0&filter_eq[status]=active'
    )
    expect((filterData as Record<string, unknown>).status).toBeNull()
  })

  // An array default is joined and each item encoded. A value needing encoding is the only way to see it.
  it('C2: an array default is encoded', () => {
    const fields = [
      { name: 'tags', mandatory: true, default: ['a b', 'c'] },
    ] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = filter(fields)
    ;(filterData as Record<string, unknown>).tags = []

    expect(generateListQuery(pagination(), filterData, filterConfig)).toBe('?limit=25&offset=0&filter_eq[tags]=a%20b,c')
  })

  // A key in the data with no entry in the config is dropped without a word.
  it('D: drops a data key that has no config entry', () => {
    const fields = [{ name: 'text', default: null }] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = filter(fields)
    ;(filterData as Record<string, unknown>).text = 'abc'
    ;(filterData as Record<string, unknown>).ghost = 'x'

    expect(generateListQuery(pagination(), filterData, filterConfig)).toBe('?limit=25&offset=0&filter_eq[text]=abc')
  })

  // Page 1 is the first page; a caller that passes 0 gets the first page too, not a negative offset.
  it('E: clamps the offset', () => {
    const fields = [] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = filter(fields)

    expect(generateListQuery(pagination({ page: 0 }), filterData, filterConfig)).toBe('?limit=25&offset=0')
  })
})
