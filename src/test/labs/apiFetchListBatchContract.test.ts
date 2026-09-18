import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchListBatch } from '@/labs/api/useApiFetchListBatch'
import { setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'

// The batch helper reads every page of a list, so the ways it can stop early are the ways it can
// quietly return half the data. Each of these pins one of them.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

const setup = (get: ReturnType<typeof vi.fn>) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
  const { execute } = useApiFetchListBatch<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
  })

  return { execute, filterData, filterConfig }
}

const counted = (ids: number[], totalCount: number) => ({
  status: 200,
  data: { data: ids.map((id) => ({ id })), totalCount },
})

const infinite = (ids: number[], hasNextPage: boolean) => ({
  status: 200,
  data: { data: ids.map((id) => ({ id })), hasNextPage },
})

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

describe('an infinite list', () => {
  // The mode has to be read from what the response said. Recognising it by "no totalCount" looks
  // equivalent and is not: an infinite page carries `totalCount: 0` to clear the counted mode's
  // leftovers, so that reading takes the counted branch, computes zero pages, and stops after one.
  it('walks every page until the answer says there are no more', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1, 2], true))
      .mockResolvedValueOnce(infinite([3, 4], true))
      .mockResolvedValueOnce(infinite([5], false))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ])
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('stops at the first page when that page says there are no more', async () => {
    const get = vi.fn().mockResolvedValueOnce(infinite([1], false))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('stops when a later page has nothing left to give', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1], true))
      .mockResolvedValueOnce({ status: 204, data: '' })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
  })
})

describe('a counted list', () => {
  it('asks for the remaining pages once it knows how many there are', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(counted([1], 3))
      .mockResolvedValueOnce(counted([2], 3))
      .mockResolvedValueOnce(counted([3], 3))
    const { execute, filterData, filterConfig } = setup(get)

    const items = await execute(filterData, filterConfig, { batchSize: 1 })

    expect(items).toHaveLength(3)
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('asks once when everything fits on one page', async () => {
    const get = vi.fn().mockResolvedValueOnce(counted([1, 2], 2))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 100 })).resolves.toHaveLength(2)
    expect(get).toHaveBeenCalledTimes(1)
  })

  // They all went out together, so there is no sequence to stop -- an empty one among them simply
  // contributes nothing.
  it('keeps the other pages when one of them comes back empty', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(counted([1], 3))
      .mockResolvedValueOnce({ status: 204, data: '' })
      .mockResolvedValueOnce(counted([3], 3))
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig, { batchSize: 1 })).resolves.toStrictEqual([{ id: 1 }, { id: 3 }])
  })
})

describe('a list that says nothing about its shape', () => {
  it('takes the page it was given and asks for no more', async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 200, data: { data: [{ id: 1 }] } })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
    expect(get).toHaveBeenCalledTimes(1)
  })
})

describe('a page that breaks the contract', () => {
  it('fails on the first page', async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 200, data: '' })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  // A server that breaks on page three is not "finished" -- half a list handed back as if it were
  // whole is worse than an error.
  it('fails on a later page too, rather than returning what it has', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(infinite([1], true))
      .mockResolvedValueOnce({ status: 200, data: '' })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a page whose body is not a list', async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: 200, data: { totalCount: 5 } })
    const { execute, filterData, filterConfig } = setup(get)

    await expect(execute(filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})
