import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import { SortOrder } from '@/domains/api/types/SortOrder'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'

// The old `apiFetchList` mutated the plain pagination object. This helper replaces the ref's value instead.
// Code that kept a reference to the old object would keep reading a count that
// never changes, with no failure. This is the trap when migrating a list call.
// `mapApiError` is shared by the family. Here only the branches a list call
// reaches itself are pinned; the others are pinned against `useApiRequest`.
// Filter-to-query translation is not covered here: every case uses a non-mandatory
// filter with an empty default. It is pinned in `queryBuilderContract.test.ts`.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

// `elastic` goes in through `createFilter`, which couples it to `simpleFilters`. A hand-assembled config is one
// the app cannot produce and would hide the difference between the search endpoint and the flat query format.
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

// The error carries the url it was called with, like an axios failure. The report renders
// the kept config, so a hard-coded url would describe a request that never happened.
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
    // The object the caller held before the call stays untouched.
    // A migration that assumed otherwise would read a stale count.
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

// A caller that re-reads a list on a timer reports its first failure and marks the rest as reported,
// as with `useApiRequest`. Otherwise a poll through an outage logs the same failure on every try.
describe('a list call that asks not to be reported', () => {
  afterEach(() => {
    // Module state shared by every file this worker runs.
    setApiErrorLogger(defaultApiErrorLogger)
  })

  it('throws as ever and the logger does not hear of it; the calls around it are reported as ever', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const get = vi
      .fn()
      .mockImplementation((url: string) => Promise.reject(axiosError({ response: { status: 500 } }, url)))
    const { execute, filterData, filterConfig, pagination } = buildApi(get)
    const fetchList = (params?: { report: boolean }) => execute(pagination, filterData, filterConfig, params)

    await expect(fetchList({ report: false })).rejects.toBeInstanceOf(AnzuApiAxiosError)
    expect(logged).not.toHaveBeenCalled()
    get.mockResolvedValueOnce({ status: 200, data: '' })
    await expect(fetchList({ report: false })).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
    expect(logged).not.toHaveBeenCalled()

    await expect(fetchList()).rejects.toBeInstanceOf(AnzuApiAxiosError)
    await expect(fetchList({ report: true })).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).toHaveBeenCalledTimes(2)
    expect(logged.mock.calls[0]![1]).toMatchObject({ system: 'test', entity: 'test', status: 500 })
  })
})
