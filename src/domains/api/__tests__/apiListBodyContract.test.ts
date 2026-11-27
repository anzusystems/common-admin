import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { type AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { readArrayBody } from '@/domains/api/utils/listBody'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import { isNull } from '@/shared/utils/common'

// The old shape guards only checked for a metadata key, so `{ totalCount:
// 1 }` counted as a list and the caller got `undefined` typed as an array.

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

  // Paginators pick the mode with `isNull`, so a non-null value means an infinite list.
  // Writing `false` for a counted list therefore means "infinite, no next page": `ADatatablePagination.vue:62`
  // disables Last, `:67` disables Next on every page, and `:73` renders the row count where the total belongs.
  // The test reads the value the way a consumer does instead of asserting `false` directly.
  it('leaves a counted list readable as a counted list', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(
      answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 4000 } })
    )

    await execute(pagination, filterData, filterConfig)

    const infiniteMode = !isNull(pagination.value.hasNextPage)
    const nextDisabled =
      (isNull(pagination.value.hasNextPage) && pagination.value.page === 160) || pagination.value.hasNextPage === false

    expect(infiniteMode).toBe(false)
    expect(nextDisabled).toBe(false)
  })

  // The next-page marker must win. The infinite envelope carries `hasNextPage`, `data` and
  // `totalCount`. The counted one carries `totalCount`, `data` and `bigTable`, never `hasNextPage`.
  // Reading the count first would turn every infinite list into a counted one, with a look-ahead sentinel as the total.
  it('lets the next-page marker win when a response carries both', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(
      answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 26, hasNextPage: true } })
    )

    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.hasNextPage).toBe(true)
    // Cleared, not carried: in that envelope the number is `offset + limit + 1`, not a count.
    expect(pagination.value.totalCount).toBe(0)
  })

  // The array is the list. A well-formed array is not discarded
  // because the count beside it is missing or has the wrong type.
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
    pagination.value = { ...pagination.value, totalCount: 42, currentViewCount: 7 }

    await expect(execute(pagination, filterData, filterConfig)).resolves.toStrictEqual([])

    // Left alone, these keep answering for the query before this one.
    expect(pagination.value.totalCount).toBe(0)
    expect(pagination.value.currentViewCount).toBe(0)
    expect(pagination.value.hasNextPage).toBeNull()
  })

  // A 204 says the list is empty, not which mode it is in, so it clears the field of the current mode.
  // For an infinite list that is `false`. Writing `null` would switch it to counted
  // mode: `ASubjectSelect` would see a next page and autoload again on the same
  // 204, and `ADatatablePagination` would offer Next and Last on an empty page.
  it('leaves an infinite list saying there is nothing after this', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 204, data: '' }))
    pagination.value = { ...pagination.value, hasNextPage: true, currentViewCount: 7 }

    await expect(execute(pagination, filterData, filterConfig)).resolves.toStrictEqual([])

    expect(pagination.value.hasNextPage).toBe(false)
    expect(pagination.value.currentViewCount).toBe(0)
  })

  it('refuses a success that carries nothing at all', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 200, data: '' }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })
})

// The types forbid these keys in `options`, but JavaScript callers can pass them anyway.
// `data` used to survive the spread when no body was passed, which put a body on a GET and skipped serialisation.
describe('what a caller cannot reach in and set', () => {
  it('strips the method, the url, the body and the signal out of options', async () => {
    const get = vi.fn().mockResolvedValue({ status: 200, data: { data: [], totalCount: 0 } })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const own = new AbortController()
    const { execute } = useApiFetchList<{ id: number }>({
      client: () => ({ get }) as unknown as AxiosInstance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
      options: {
        params: { keep: 'this' },
        method: 'DELETE',
        url: '/somewhere-else',
        data: { smuggled: true },
        signal: own.signal,
      } as never,
    })

    await execute(pagination, filterData, filterConfig)

    const config = get.mock.calls[0][1]
    expect(get.mock.calls[0][0]).toContain('/items')
    expect(config.params).toStrictEqual({ keep: 'this' })
    expect(config.method).toBeUndefined()
    expect(config.url).toBeUndefined()
    expect(config.data).toBeUndefined()
    expect(config.signal).not.toBe(own.signal)
  })
})

describe('what reaches the log', () => {
  // The failure carries the url it was called with, like an axios failure. A hard-coded
  // fixture url would claim a request that never happened, and the report would show it.
  const failing = (over: Record<string, unknown> = {}) =>
    vi.fn().mockImplementation((url: string) => Promise.reject(axiosError(over, url)))
  const axiosError = (over: Record<string, unknown> = {}, url = '/items') =>
    Object.assign(new Error('request failed'), { isAxiosError: true, config: { url } }, over)

  it('writes down a transport failure once, with what was asked for', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute, pagination, filterData, filterConfig } = setup(failing({ response: { status: 500 } }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged.mock.calls[0][1]).toMatchObject({ system: 'test', entity: 'test' })
    // Assert the query too. Naming the template instead of the request is
    // the failure being caught, and `/items` alone cannot tell them apart.
    expect(logged.mock.calls[0][1].url).toContain('/items?')
    expect(logged.mock.calls[0][1].url).toContain('limit=')
  })

  // A contract error raised by the helper itself signals a call site that was not migrated.
  // Mapping cannot log it because it is already an Anzu error by then, so reporting happens after mapping.
  it('writes down the contract errors the helper raises itself', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute, pagination, filterData, filterConfig } = setup(answering({ status: 200, data: { totalCount: 1 } }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(logged).toHaveBeenCalledTimes(1)
  })

  // Axios appends `options.params` when it sends, so a url recorded before the call is not the one that went out.
  // For an error the helper raised itself, axios kept no config, so the url is rendered from what the call asked for.
  it('names the url as it was actually requested, query and all', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      // The double needs `getUri`. The helper asks axios to build the reported url.
      client: () =>
        ({
          get: vi.fn().mockResolvedValue({ status: 200, data: { totalCount: 1 } }),
          getUri: (config: unknown) => axios.getUri(config as never),
        }) as unknown as AxiosInstance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
      options: { params: { scope: 'archive' } },
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(logged.mock.calls[0][1].url).toContain('scope=archive')
  })

  // Axios merges the client `baseURL` and default `params` when it sends.
  // Asking for the url only when the call had its own `params` made reports
  // inconsistent: a relative path for one failure and an absolute url for the next.
  it('names the client baseURL and its default params even when the call adds none', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://api.test/v1', params: { lang: 'sk' } })
    instance.get = vi.fn().mockResolvedValue({ status: 200, data: { totalCount: 1 } })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      client: () => instance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(logged.mock.calls[0][1].url).toContain('https://api.test/v1/items?')
    expect(logged.mock.calls[0][1].url).toContain('lang=sk')
  })

  // The rendering gets the call's own config. A request with custom params serialisation
  // would otherwise print `ids[]=1&ids[]=2` for a request sent as `ids=1+2`.
  it('renders the params the way the call itself serialises them', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://api.test/v1' })
    instance.get = vi.fn().mockResolvedValue({ status: 200, data: { totalCount: 1 } })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      client: () => instance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
      options: {
        params: { ids: [1, 2] },
        paramsSerializer: (params: Record<string, unknown>) => `ids=${(params.ids as number[]).join('+')}`,
      },
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(logged.mock.calls[0][1].url).toContain('ids=1+2')
    expect(logged.mock.calls[0][1].url).not.toContain('ids%5B%5D')
  })

  // The url is described after the failure, when the client may have changed:
  // a new instance, moved defaults, or an interceptor that rewrote the url.
  // Axios keeps the config it sent on the error, so that is
  // rendered. A reconstruction is used only when nothing was kept.
  it('names the request as axios sent it, not as the client would build it now', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://sent.test/v1' })
    instance.get = vi.fn().mockImplementation(() => {
      const failure = axiosError({
        response: { status: 500 },
        config: { baseURL: 'https://sent.test/v1', url: '/items', params: { page: 2 } },
      })
      instance.defaults.baseURL = 'https://moved-on.test/v9'

      return Promise.reject(failure)
    })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      client: () => instance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged.mock.calls[0][1].url).toBe('https://sent.test/v1/items?page=2')
  })

  // `getUri` merges the instance's defaults under the config it receives.
  // Rendering through the caller's client would show a default added after the request
  // in a url that never had it. So rendering uses an instance with no defaults.
  it('does not let a default added after the request appear in the url it names', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://sent.test/v1' })
    instance.get = vi.fn().mockImplementation(() => {
      const failure = axiosError({
        response: { status: 500 },
        config: { baseURL: 'https://sent.test/v1', url: '/items' },
      })
      instance.defaults.params = { added_later: 'yes' }

      return Promise.reject(failure)
    })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      client: () => instance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged.mock.calls[0][1].url).toBe('https://sent.test/v1/items')
  })

  // A failure the helper raises after reading the response is not an axios error and has no config.
  // The response it read does, and that config is the request as sent, interceptors included.
  // Rebuilding it would describe the request as the client would send it now.
  it('names the request as sent even when the helper is what refused it', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://api.test/v1' })
    instance.get = vi.fn().mockResolvedValue({
      status: 200,
      data: { totalCount: 1 },
      config: { baseURL: 'https://api.test/v1', url: '/rewritten-by-interceptor', params: { page: 3 } },
    })
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      client: () => instance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiResponseCodeError)

    expect(logged.mock.calls[0][1].url).toBe('https://api.test/v1/rewritten-by-interceptor?page=3')
    // Check the message too. Report readers see message and context together, and a message
    // with the pre-interceptor url next to a context with the final one describes two requests.
    expect((logged.mock.calls[0][0] as Error).message).toContain('https://api.test/v1/rewritten-by-interceptor?page=3')
  })

  // A call that never reached the wire requested no url. Neither
  // the client root nor the path about to be built is an answer.
  it('names no url at all when the call failed before it dispatched', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://api.test/v1', params: { lang: 'sk' } })
    instance.get = vi.fn()
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    // No template anywhere: it throws while building its url, before a request goes out.
    const { execute } = useApiFetchList<{ id: number }>({ client: () => instance, system: 'test', entity: 'test' })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuFatalError)

    expect(instance.get).not.toHaveBeenCalled()
    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })

  // Url building runs in the catch on every failure path. An exception
  // in it would replace the error the caller is waiting for.
  it('never lets url building replace the failure it was describing', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      client: () =>
        ({
          get: vi.fn().mockRejectedValue(axiosError({ response: { status: 500 } })),
          getUri: () => {
            throw new Error('url building is broken')
          },
        }) as unknown as AxiosInstance,
      system: 'test',
      entity: 'test',
      urlTemplate: '/items',
      options: { params: { scope: 'archive' } },
    })

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })

  it('says nothing at all once reporting is turned off', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    setApiErrorLogger(null)
    const { execute, pagination, filterData, filterConfig } = setup(failing({ response: { status: 500 } }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)

    expect(logged).not.toHaveBeenCalled()
  })

  it('does not let a broken logger replace the failure the caller is waiting for', async () => {
    setApiErrorLogger(() => {
      throw new Error('the logger itself is broken')
    })
    const { execute, pagination, filterData, filterConfig } = setup(failing({ response: { status: 500 } }))

    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuApiAxiosError)
  })
})

// Tested directly, unlike `readListBody`, which is driven through
// `useApiFetchList` because it also writes pagination. Nothing is written here.
describe('what counts as an array body', () => {
  it('hands back the array it was given, by reference', () => {
    const rows = [{ id: 1 }]

    expect(readArrayBody(rows, 200, '/x')).toBe(rows)
  })

  it('accepts an empty array', () => {
    expect(readArrayBody([], 200, '/x')).toEqual([])
  })

  it('refuses an envelope, and names the url', () => {
    let thrown: unknown

    try {
      readArrayBody({ data: [] }, 200, '/x')
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(AnzuApiResponseCodeError)
    expect((thrown as AnzuApiResponseCodeError).code).toBe(200)
    expect((thrown as Error).message).toContain('/x')
  })

  it.each([[null], ['text'], [1], [undefined]])('refuses %p', (body) => {
    expect(() => readArrayBody(body, 200, '/x')).toThrow(AnzuApiResponseCodeError)
  })
})
