import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { type AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { usePagination } from '@/labs/filters/pagination'
import { isNull } from '@/utils/common'

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

  // What the paginators do with the field, which is the only reason its value matters. They pick the
  // mode with `isNull`: a non-null value means an infinite list. Writing `false` for a counted one
  // therefore says "infinite, with no next page" -- `ADatatablePagination.vue:62` disables Last,
  // `:67` disables Next on every page, and `:73` renders the rows on screen where the total belongs.
  // The tests above pinned `false` and so confirmed it, which is why this one reads the value the way
  // a consumer does rather than asserting it directly.
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

  // One response must not be readable two ways, and which field decides is not a free choice: the
  // backend's infinite envelope carries `hasNextPage`, `data` AND `totalCount`, while the counted one
  // carries `totalCount`, `data` and `bigTable` and never `hasNextPage`. So a response carrying both
  // is an infinite list, every time, and reading the count first would turn every infinite list in
  // the fleet into a counted one -- with a number that is not a total but a look-ahead sentinel.
  it('lets the next-page marker win when a response carries both', async () => {
    const { execute, pagination, filterData, filterConfig } = setup(
      answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 26, hasNextPage: true } })
    )

    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.hasNextPage).toBe(true)
    // Cleared, not carried: in that envelope the number is `offset + limit + 1`, not a count.
    expect(pagination.value.totalCount).toBe(0)
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
    pagination.value = { ...pagination.value, totalCount: 42, currentViewCount: 7 }

    await expect(execute(pagination, filterData, filterConfig)).resolves.toStrictEqual([])

    // Left alone, these keep answering for the query before this one.
    expect(pagination.value.totalCount).toBe(0)
    expect(pagination.value.currentViewCount).toBe(0)
    // Still a counted list: nothing about the answer said it had become anything else.
    expect(pagination.value.hasNextPage).toBeNull()
  })

  // A 204 says the list is empty, not which kind of list it is -- so it clears the field of whichever
  // mode the pagination is already in. For an infinite list that is `false`, which is what the 204
  // means there: nothing after this. Writing `null` for both puts an infinite list into counted mode,
  // where `ASubjectSelect` reads a next page as available and its autoload fires again on the same
  // 204, and `ADatatablePagination` offers Next and Last on an empty page.
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

// What `options` is not allowed to decide. The type says so, but a type says nothing at runtime and
// javascript callers exist: `data` in particular used to survive the spread whenever no body was
// passed, so a caller could put a body on a GET through the back door and skip the serialisation.
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
        // None of these may survive; a javascript caller can pass them even though the type forbids it.
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
  // The failure carries the url it was called with, the way an axios failure does. A fixture that
  // hard-codes one is claiming a request that was never made, and since the config axios kept is
  // what the report renders, it would be believed.
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
    // The query too, not just the path: naming the template instead of the request is the failure
    // this assertion exists to catch, and `/items` alone cannot tell them apart.
    expect(logged.mock.calls[0][1].url).toContain('/items?')
    expect(logged.mock.calls[0][1].url).toContain('limit=')
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

  // Axios appends `options.params` itself when it sends, so a url recorded before the call is not
  // the one that went out -- and a report naming a url nobody can find in the network tab is worse
  // than no url. This is the failure the helper raised itself: axios succeeded and kept no config of
  // its own, so the url has to be rendered from what the call asked for.
  it('names the url as it was actually requested, query and all', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const store = createFilterStore(fields)
    const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
    const { pagination } = usePagination('id')
    const { execute } = useApiFetchList<{ id: number }>({
      // `getUri` included: the helper asks axios to build the url it reports, so a double without
      // it is not standing in for an axios instance.
      client: () =>
        ({
          // A body that is not a list: the helper refuses it, and that error carries no axios config.
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

  // A client carries a `baseURL` and can carry default `params`, and axios merges both in when it
  // sends. Asking it for the url only when the call brought `params` of its own meant the report
  // named a relative path for one failure and an absolute url for the next -- the same request,
  // described two ways, and neither matching what a reader would search the network tab for.
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

  // And that rendering is handed the call's own config, not just its params: a request that
  // serialises its params itself is asking for a url the defaults do not produce, and rendering it
  // the default way would print `ids[]=1&ids[]=2` for a request that went out as `ids=1+2`.
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

  // The url is described after the request failed, and by then the client may not be the one that
  // sent it: the factory can hand back a new instance, its defaults can have moved on, and a request
  // interceptor can have rewritten the url on the way out. Axios keeps the config it actually sent
  // on the error, so that is what gets rendered -- a reconstruction is only used when there is
  // nothing kept.
  it('names the request as axios sent it, not as the client would build it now', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://sent.test/v1' })
    instance.get = vi.fn().mockImplementation(() => {
      // What the request looked like once axios was done with it, interceptors included.
      const failure = axiosError({
        response: { status: 500 },
        config: { baseURL: 'https://sent.test/v1', url: '/items', params: { page: 2 } },
      })
      // ...and the client moves on before anyone describes the failure.
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

  // `getUri` merges the instance's defaults under the config it is handed, so rendering a config
  // axios kept through the caller's own client lets a default added since the request appear in a
  // url that never carried it. That is why the rendering goes through an instance with no defaults.
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

  // A failure the helper raises after reading the response is not an axios error and carries no
  // config, but the response it read does -- and that config is the request as it went out, past any
  // interceptor. Rebuilding one instead describes the request as the client would send it now.
  it('names the request as sent even when the helper is what refused it', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const instance = axios.create({ baseURL: 'https://api.test/v1' })
    // A request interceptor rewrote the url on the way out; the body that came back is not a list.
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
    // The message too, not only the context. They are read side by side in a report, and a message
    // naming the url before the interceptor next to a context naming the one after it describes two
    // requests for one failure.
    expect((logged.mock.calls[0][0] as Error).message).toContain('https://api.test/v1/rewritten-by-interceptor?page=3')
  })

  // A call that never reached the wire requested no url, and the field says which url was requested.
  // Neither the client root nor the path it was about to build is an answer to that.
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

  // It runs inside the catch on every failure path, so an exception in it would replace the error
  // the caller is waiting for with one about building a diagnostic string.
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
