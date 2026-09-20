import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiFetchItems } from '@/labs/api/useApiFetchItems'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiCancelledError } from '@/model/error/AnzuApiCancelledError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'

// The helper for the calls that were reaching for `useApiRequest<ApiResponseList<T[]>>`: a list
// whose query the call site wrote itself. What it has to add over that is the list-body check --
// those call sites read `.data` off whatever came back, so a malformed answer handed them
// `undefined` typed as an array, which is the failure the whole family exists to end.

const setup = (get: ReturnType<typeof vi.fn>, over: Record<string, unknown> = {}) =>
  useApiFetchItems<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
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
    const get = answering({ status: 200, data: { data: [{ id: 1 }], totalCount: 1 } })
    const { execute } = setup(get)

    await execute()

    expect(get.mock.calls[0][0]).toBe('/items?limit=50&order[id]=desc')
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
    const get = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(get, { urlTemplate: '/article/:id/routes?limit=10' })

    await execute({ urlParams: { id: 7 } })

    expect(get.mock.calls[0][0]).toBe('/article/7/routes?limit=10')
  })

  // The substitution is the path's, not the query's, and this is the helper where someone would
  // expect otherwise. Pinned so the doc comment above `urlTemplate` cannot drift from it.
  it('substitutes into the path and leaves the query as written', async () => {
    const get = answering({ status: 200, data: { data: [], totalCount: 0 } })
    const { execute } = setup(get, { urlTemplate: '/article/:id/routes?locale=:locale' })

    await execute({ urlParams: { id: 7, locale: 'sk' } })

    expect(get.mock.calls[0][0]).toBe('/article/7/routes?locale=:locale')
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
    const get = vi.fn()
    const { execute } = setup(get, { urlTemplate: undefined })

    await expect(execute()).rejects.toBeInstanceOf(AnzuFatalError)

    expect(get).not.toHaveBeenCalled()
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
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      seen = config.signal

      return new Promise(() => {})
    })
    const { execute, abort } = setup(get)

    void execute()
    abort()

    expect(seen?.aborted).toBe(true)
  })

  // `cancelPrevious` has to behave the way it does everywhere else in the family.
  it('supersedes the earlier call when asked to', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute } = setup(get, { cancelPrevious: true })

    void execute()
    void execute()

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('stops one call through a signal of its own, leaving the others alone', async () => {
    const own = new AbortController()
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)

      return new Promise(() => {})
    })
    const { execute } = setup(get)

    void execute({ signal: own.signal })
    void execute()
    own.abort()

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })
})
