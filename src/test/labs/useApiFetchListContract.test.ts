import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { usePagination } from '@/labs/filters/pagination'
import { SortOrder } from '@/composables/system/datatableColumns'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiForbiddenError } from '@/model/error/AnzuApiForbiddenError'
import { AnzuApiTimeoutError } from '@/model/error/AnzuApiTimeoutError'

// The list fetch, and the part of it a caller cannot see: what it writes back into pagination.
//
// The helper this replaces -- `apiFetchList` -- took a plain object and MUTATED it, so a caller
// holding that object saw `totalCount` appear in it. This one replaces the ref's value instead.
// Anything that kept a reference to the old object and read the count off it afterwards would go
// on reading a number that no longer changes, with nothing to fail. That is the trap in migrating
// a list call, and it is the reason for the first block below.
//
// The error mapping is one function now (`mapApiError`), shared by the whole family; this file used
// to say it was a third hand-written copy and that is no longer true. What is pinned below is that a
// list call reaches that mapping at all and gets the right class out of it -- three of the branches,
// the ones a list call can reach on its own. The other five are pinned against `useApiRequest`.
//
// Not pinned here: the translation of a filter into the query. Every case below runs with a
// non-mandatory filter whose default is empty, so `getValue` answers null and no `filter_*` is ever
// emitted. That translation is pinned in `queryBuilderContract.test.ts`, against both builders.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

// `elastic` goes in through `createFilter`, not onto the config afterwards: only `createFilter`
// couples it to `simpleFilters`, so a config assembled by hand is one the app cannot produce and
// would hide the difference between the search endpoint and the flat query format.
const setup = (sortKey: string | null = 'id', elastic = false) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj', elastic })
  const { pagination } = usePagination(sortKey)
  return { filterData, filterConfig, pagination }
}

const buildApi = (get: ReturnType<typeof vi.fn>, elastic = false) => {
  const { filterData, filterConfig, pagination } = setup('id', elastic)
  const { execute } = useApiFetchList<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
  })
  return { execute, filterData, filterConfig, pagination }
}

const listResponse = (data: Array<{ id: number }>, over: Record<string, unknown> = {}) => ({
  status: 200,
  data: { data, totalCount: data.length, ...over },
})

// The url it was called with, the way an axios failure carries it: the report renders the config
// axios kept, so a hard-coded one would have it describe a request that never happened.
const axiosError = (over: Record<string, unknown> = {}, url = '/items') =>
  Object.assign(new Error('request failed'), { isAxiosError: true, config: { url } }, over)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('what the list fetch writes back', () => {
  it('replaces the pagination value rather than filling in the old one', async () => {
    const get = vi.fn().mockResolvedValue(listResponse([{ id: 1 }, { id: 2 }], { totalCount: 57 }))
    const { execute, filterData, filterConfig, pagination } = buildApi(get)
    const before = pagination.value

    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.totalCount).toBe(57)
    expect(pagination.value.currentViewCount).toBe(2)
    // The object the caller held before the call is untouched. A migration that assumed otherwise
    // would read a count that stopped moving, and nothing would say so.
    expect(before.totalCount).toBe(0)
    expect(pagination.value).not.toBe(before)
  })

  it('carries hasNextPage instead of a count for an infinite list', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, data: { data: [{ id: 1 }], hasNextPage: true } })
    const { execute, filterData, filterConfig, pagination } = buildApi(get)

    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.hasNextPage).toBe(true)
    expect(pagination.value.currentViewCount).toBe(1)
  })

  it('answers with an empty list for a no-content response', async () => {
    const get = vi.fn().mockResolvedValue({ status: 204, data: '' })
    const { execute, filterData, filterConfig, pagination } = buildApi(get)

    await expect(execute(pagination, filterData, filterConfig)).resolves.toEqual([])
  })
})

describe('the url the list fetch asks for', () => {
  it('carries the limit, the offset and the order', async () => {
    const get = vi.fn().mockResolvedValue(listResponse([]))
    const { execute, filterData, filterConfig, pagination } = buildApi(get)
    pagination.value = {
      ...pagination.value,
      page: 3,
      rowsPerPage: 25,
      sortBy: { key: 'title', order: SortOrder.Desc },
    }

    await execute(pagination, filterData, filterConfig)

    const url = get.mock.calls[0][0] as string
    expect(url).toContain('limit=25')
    expect(url).toContain('offset=50')
    expect(url).toContain('order[title]=desc')
  })

  it('goes to the search endpoint only when the filter says so', async () => {
    const plainGet = vi.fn().mockResolvedValue(listResponse([]))
    const plain = buildApi(plainGet)
    await plain.execute(plain.pagination, plain.filterData, plain.filterConfig)

    const elasticGet = vi.fn().mockResolvedValue(listResponse([]))
    const elastic = buildApi(elasticGet, true)
    await elastic.execute(elastic.pagination, elastic.filterData, elastic.filterConfig)

    expect(String(plainGet.mock.calls[0][0]).startsWith('/items?')).toBe(true)
    expect(String(elasticGet.mock.calls[0][0]).startsWith('/items/search')).toBe(true)
  })

  it('appends /search when a single call forces it', async () => {
    const get = vi.fn().mockResolvedValue(listResponse([]))
    const { execute, filterData, filterConfig, pagination } = buildApi(get)

    await execute(pagination, filterData, filterConfig, { forceElastic: true })

    expect(String(get.mock.calls[0][0]).startsWith('/items/search')).toBe(true)
  })

  it('lets a call override the url it was built with', async () => {
    const get = vi.fn().mockResolvedValue(listResponse([]))
    const { execute, filterData, filterConfig, pagination } = buildApi(get)

    await execute(pagination, filterData, filterConfig, { urlTemplate: '/other/:id', urlParams: { id: 4 } })

    expect(String(get.mock.calls[0][0]).startsWith('/other/4')).toBe(true)
  })
})

describe('what the list fetch throws', () => {
  const failing = (over: Record<string, unknown> = {}) => {
    const get = vi.fn().mockImplementation((url: string) => Promise.reject(axiosError(over, url)))
    const { execute, filterData, filterConfig, pagination } = buildApi(get)
    return () => execute(pagination, filterData, filterConfig)
  }

  it('tells a forbidden response from the rest', async () => {
    await expect(failing({ response: { status: 403 } })()).rejects.toBeInstanceOf(AnzuApiForbiddenError)
  })

  it('tells a timeout from a backend that answered', async () => {
    await expect(failing({ code: 'ECONNABORTED' })()).rejects.toBeInstanceOf(AnzuApiTimeoutError)
  })

  it('hands back every other axios failure with the response on its cause', async () => {
    await expect(failing({ response: { status: 500 } })()).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })
})
