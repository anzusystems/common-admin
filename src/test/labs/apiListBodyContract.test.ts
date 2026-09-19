import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { usePagination } from '@/labs/filters/pagination'

// What a list answer has to look like, and what the pagination beside it is allowed to say.
//
// The shape guards this replaces tested for a metadata key and nothing else, so `{ totalCount: 1 }`
// counted as a list and the caller was handed `undefined` typed as an array.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

const setup = (get: ReturnType<typeof vi.fn>) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
  const { pagination } = usePagination('id')
  const { execute } = useApiFetchList<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
  })

  return { execute, pagination, filterData, filterConfig }
}

const answering = (res: unknown) => vi.fn().mockResolvedValue(res)

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

afterEach(() => {
  // Put it back. It is module state shared by every file this worker runs, so a test that leaves
  // its own behind decides what the next file sees.
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('what counts as a list body', () => {
  it('takes the array and the count that came with it', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(
      answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 9 } })
    )

    await expect(execute(pagination, filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
    expect(pagination.value.totalCount).toBe(9)
    expect(pagination.value.currentViewCount).toBe(1)
  })

  it('reads an infinite list by its own marker', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(
      answering({ status: 200, data: { data: [{ id: 1 }], hasNextPage: true } })
    )

    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.hasNextPage).toBe(true)
  })

  // One response must not be readable two ways.
  it('lets the count win when a response claims to be both', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(
      answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 4, hasNextPage: true } })
    )

    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.totalCount).toBe(4)
    expect(pagination.value.hasNextPage).toBe(false)
  })

  // The array is the list. Metadata says which kind of list it is, and a well-formed array is not
  // worth discarding because the number beside it is missing or of the wrong type.
  it.each([
    ['no metadata at all', { data: [{ id: 1 }] }],
    ['a count that is not a number', { data: [{ id: 1 }], totalCount: 'nine' }],
    ['a marker that is not a boolean', { data: [{ id: 1 }], hasNextPage: 'yes' }],
  ])('still answers with the array when the response has %s', async (_label, body) => {
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 200, data: body }))
    const before = { ...pagination.value }

    await expect(execute(pagination, filterData, filterConfig)).resolves.toStrictEqual([{ id: 1 }])
    expect(pagination.value.totalCount).toBe(before.totalCount)
    expect(pagination.value.hasNextPage).toBe(before.hasNextPage)
  })

  it.each([
    ['metadata but no array', { totalCount: 1 }],
    ['an array under the wrong key', { items: [{ id: 1 }] }],
    ['something that is not an object', 'a string'],
  ])('refuses a response with %s', async (_label, body) => {
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 200, data: body }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('answers an empty list for a no-content response, and says so in the metadata', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 204, data: '' }))
    pagination.value = { ...pagination.value, totalCount: 42, hasNextPage: true, currentViewCount: 7 }

    await expect(execute(pagination, filterData, filterConfig)).resolves.toStrictEqual([])

    // Left alone, these keep answering for the query before this one.
    expect(pagination.value.totalCount).toBe(0)
    expect(pagination.value.hasNextPage).toBe(false)
    expect(pagination.value.currentViewCount).toBe(0)
  })

  it('refuses a success that carries nothing at all', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 200, data: '' }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})

describe('what reaches the log', () => {
  const failing = (error: unknown) => vi.fn().mockRejectedValue(error)
  const axiosError = (over: Record<string, unknown> = {}) =>
    Object.assign(new Error('request failed'), { isAxiosError: true, config: { url: '/items' } }, over)

  it('writes down a transport failure once, with what was asked for', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute, pagination, filterData, filterConfig } = setup(failing(axiosError({ response: { status: 500 } })))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged.mock.calls[0][1]).toMatchObject({ system: 'test', entity: 'test' })
    expect(logged.mock.calls[0][1].url).toContain('/items')
  })

  // The error a helper raises about its own contract is the signal that a call site has not been
  // migrated. Mapping cannot log it -- it is already an Anzu error by then -- which is why the
  // reporting happens after.
  it('writes down the contract errors the helper raises itself', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 200, data: { totalCount: 1 } }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(logged).toHaveBeenCalledTimes(1)
  })

  it('says nothing at all once reporting is turned off', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    setApiErrorLogger(null)
    const { execute, pagination, filterData, filterConfig } = setup(failing(axiosError({ response: { status: 500 } })))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).not.toHaveBeenCalled()
  })

  it('does not let a broken logger replace the failure the caller is waiting for', async () => {
    setApiErrorLogger(() => {
      throw new Error('the logger itself is broken')
    })
    const { execute, pagination, filterData, filterConfig } = setup(failing(axiosError({ response: { status: 500 } })))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })
})
