import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { type FetchItemsParams, useApiFetchItems } from '@/labs/api/useApiFetchItems'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiCancelledError } from '@/model/error/AnzuApiCancelledError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'

// The helper for the calls that were reaching for `useApiRequest<ApiResponseList<T[]>>`: a list
// whose query the call site wrote itself. What it has to add over that is the list-body check --
// those call sites read `.data` off whatever came back, so a malformed answer handed them
// `undefined` typed as an array, which is the failure the whole family exists to end.

const setup = (request: ReturnType<typeof vi.fn>, over: Record<string, unknown> = {}) =>
  useApiFetchItems<{ id: number }>({
    client: () => ({ request }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items?limit=50&order[id]=desc',
    ...over,
  })

const answering = (res: unknown) => vi.fn().mockResolvedValue(res)

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

afterEach(() => {
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('a list whose query the caller wrote', () => {
  it('asks for the url as given, query and all', async () => {
    const request = answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 1 } })
    const { execute } = setup(request)

    await execute()

    expect(request.mock.calls[0][0].url).toBe('/items?limit=50&order[id]=desc')
  })

  it('answers with the items, not the envelope', async () => {
    const { execute } = setup(answering({ status: 200, data: { data: [{ id: 1 }, { id: 2 }], totalCount: 2 } }))

    await expect(execute()).resolves.toStrictEqual([{ id: 1 }, { id: 2 }])
  })

  // An infinite envelope is the other shape these call sites receive, and the items are what they
  // wanted from it either way.
  it('reads an infinite envelope the same way', async () => {
    const { execute } = setup(answering({ status: 200, data: { data: [{ id: 3 }], hasNextPage: true } }))

    await expect(execute()).resolves.toStrictEqual([{ id: 3 }])
  })

  it('substitutes url parameters', async () => {
    const request = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(request, { urlTemplate: '/article/:id/routes?limit=10' })

    await execute({ urlParams: { id: 7 } })

    expect(request.mock.calls[0][0].url).toBe('/article/7/routes?limit=10')
  })

  // The substitution is the path's, not the query's, and this is the helper where someone would
  // expect otherwise. Pinned so the doc comment above `urlTemplate` cannot drift from it.
  it('substitutes into the path and leaves the query as written', async () => {
    const request = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(request, { urlTemplate: '/article/:id/routes?locale=:locale' })

    await execute({ urlParams: { id: 7, locale: 'sk' } })

    expect(request.mock.calls[0][0].url).toBe('/article/7/routes?locale=:locale')
  })

  it('answers an empty list for a no-content response', async () => {
    const { execute } = setup(answering({ status: 204, data: '' }))

    await expect(execute()).resolves.toStrictEqual([])
  })

  // The reason this helper exists rather than another `useApiRequest` generic.
  it('refuses a body that is not a list, rather than handing back undefined', async () => {
    const { execute } = setup(answering({ status: 200, data: { totalCount: 1 } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a success that carries nothing at all', async () => {
    const { execute } = setup(answering({ status: 200, data: '' }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('refuses a status outside the successful ones', async () => {
    const { execute } = setup(answering({ status: 206, data: { data: [], totalCount: 0 } }))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiResponseCodeError)
  })

  it('fails like the rest of the family when the template is missing', async () => {
    const request = vi.fn()
    const { execute } = setup(request, { urlTemplate: undefined })

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)

    expect(request).not.toHaveBeenCalled()
  })
})

describe('stopping a fetch of items', () => {
  it('tells a stopped request from a failed one', async () => {
    const cancelled = Object.assign(new Error('canceled'), {
      isAxiosError: true,
      name: 'CanceledError',
      code: 'ERR_CANCELED',
      config: { url: '/items' },
    })
    const { execute } = setup(vi.fn().mockRejectedValue(cancelled))

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiCancelledError)
  })

  it('stops what it has in flight', async () => {
    let seen: AbortSignal | undefined
    const request = vi.fn().mockImplementation((config: { signal: AbortSignal }) => {
      seen = config.signal

      return new Promise(() => {})
    })
    const { execute, abort } = setup(request)

    void execute()
    abort()

    expect(seen?.aborted).toBe(true)
  })

  // `cancelPrevious` has to behave the way it does everywhere else in the family.
  it('supersedes the earlier call when asked to', async () => {
    const signals: AbortSignal[] = []
    const request = vi.fn().mockImplementation((config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute } = setup(request, { cancelPrevious: true })

    void execute()
    void execute()

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('stops one call through a signal of its own, leaving the others alone', async () => {
    const own = new AbortController()
    const signals: AbortSignal[] = []
    const request = vi.fn().mockImplementation((config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute } = setup(request)

    void execute({ signal: own.signal })
    void execute()
    own.abort()

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })
})

// The caller says which of the two shapes a list arrives in, and the reader refuses the other. The
// point is not tidiness: a shape that is merely assumed is the hole this helper was built to close.
describe('the shape the caller declared', () => {
  it('takes a bare array when that is what was declared', async () => {
    const request = answering({ status: 200, data: [{ id: 1 }, { id: 2 }] })
    const { execute } = setup(request, { shape: 'array' })

    await expect(execute()).resolves.toEqual([{ id: 1 }, { id: 2 }])
  })

  it('refuses an envelope where an array was declared', async () => {
    const request = answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 1 } })
    const { execute } = setup(request, { shape: 'array' })

    await expect(execute()).rejects.toThrow(/Expected an array body/)
  })

  // owl answers 202 with a problem document when an aggregation has not caught up. It is a valid
  // status, so it reaches the reader -- and before this, its object was handed back as an array.
  it('names a 202 that answers with something other than the list', async () => {
    const request = answering({ status: 202, data: { type: 'about:blank', title: 'not processed yet' } })
    const { execute } = setup(request, { shape: 'array' })

    await expect(execute()).rejects.toMatchObject({ code: 202 })
  })

  it('reads 204 as an empty list for an array too', async () => {
    const request = answering({ status: 204, data: '' })
    const { execute } = setup(request, { shape: 'array' })

    await expect(execute()).resolves.toEqual([])
  })

  // The other direction, which is what makes the default safe to have.
  it('refuses a bare array where the envelope was left to default', async () => {
    const request = answering({ status: 200, data: [{ id: 1 }] })
    const { execute } = setup(request)

    await expect(execute()).rejects.toThrow(/Expected a list body/)
  })
})

describe('the method and the body', () => {
  it('asks with GET and no body when nothing says otherwise', async () => {
    const request = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(request)

    await execute()

    expect(request.mock.calls[0][0].method).toBe('GET')
    expect(request.mock.calls[0][0]).not.toHaveProperty('data')
  })

  it('sends a serialised body when the method takes one', async () => {
    const request = answering({ status: 200, data: [{ id: 1 }] })
    const { execute } = setup(request, { method: 'POST', shape: 'array' })

    await execute({ body: { ids: [1] } } as never)

    expect(request.mock.calls[0][0].method).toBe('POST')
    expect(request.mock.calls[0][0].data).toBe(JSON.stringify({ ids: [1] }))
  })

  it.each([['PUT'], ['PATCH']])('passes %s through unchanged', async (method) => {
    const request = answering({ status: 200, data: [{ id: 1 }] })
    const { execute } = setup(request, { method, shape: 'array' })

    await execute()

    expect(request.mock.calls[0][0].method).toBe(method)
  })

  it('omits a null body, as the rest of the family does', async () => {
    const request = answering({ status: 200, data: [{ id: 1 }] })
    const { execute } = setup(request, { method: 'POST', shape: 'array' })

    await execute({ body: null } as never)

    expect(request.mock.calls[0][0]).not.toHaveProperty('data')
  })

  // The guard exists because `method` defaults to GET: a caller who wrote a body and forgot the
  // method would otherwise send a GET without its filter and nothing downstream would notice.
  it('refuses a body on a GET, before anything is sent', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const request = vi.fn()
    const { execute } = setup(request)

    await expect(execute({ body: { ids: [1] } } as never)).rejects.toBeInstanceOf(AnzuFatalError)

    expect(request).not.toHaveBeenCalled()
    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })

  // Now that the helper sends the method, a caller must not be able to reach it through `options`.
  it('keeps the method and the body out of a caller options object', async () => {
    const request = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(request, { options: { method: 'DELETE', data: 'x' } as never })

    await execute()

    expect(request.mock.calls[0][0].method).toBe('GET')
    expect(request.mock.calls[0][0]).not.toHaveProperty('data')
  })

  // `url` is recorded last for this reason: a body that will not serialise is a request that never
  // happened, and the report must not name a url nobody was ever asked for.
  it('reports a body that will not serialise without naming a url', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const request = vi.fn()
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const { execute } = setup(request, { method: 'POST', shape: 'array' })

    await expect(execute({ body: circular } as never)).rejects.toBeInstanceOf(AnzuFatalError)

    expect(request).not.toHaveBeenCalled()
    expect(logged.mock.calls[0][1].url).toBeUndefined()
  })
})

// Checked by `lint:tsc:test`, not by running: the guarantee is that a body cannot be passed until
// the caller has declared its type, which is what keeps every existing call site compiling untouched.
describe('what the types allow', () => {
  const client = () => ({ request: vi.fn() }) as unknown as AxiosInstance

  it('refuses a body until one is declared', () => {
    const { execute } = useApiFetchItems<{ id: number }>({ client, system: 'test', entity: 'test' })

    // @ts-expect-error `B` defaults to `never`, so there is no body to pass
    // Awaited, not fired and forgotten: with no url template it rejects, and an unhandled rejection
    // is reported against whichever test happens to be running when it lands.
    void execute({ body: {} }).catch(() => {})

    expect(execute).toBeTypeOf('function')
  })

  // Paired with the negative above on purpose: a lone `@ts-expect-error` goes on passing once the
  // line starts failing for some other reason, and would outlive the guarantee it was written for.
  it('takes the declared body once it is', () => {
    const { execute } = useApiFetchItems<{ id: number }, { ids: number[] }>({
      client,
      system: 'test',
      entity: 'test',
    })

    expectTypeOf(execute).parameter(0).toEqualTypeOf<FetchItemsParams<{ ids: number[] }> | undefined>()
  })
})
