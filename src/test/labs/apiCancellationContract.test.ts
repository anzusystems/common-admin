import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiRequest } from '@/labs/api/useApiRequest'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { setApiErrorLogger } from '@/labs/api/apiErrors'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/model/error/AnzuApiCancelledError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/labs/filters/filterFactory'
import { usePagination } from '@/labs/filters/pagination'

// Stopping a request is an ordinary thing to do -- another keystroke in an autocomplete, a route
// change while a list loads -- so it has to be tellable from a request that failed. It used to
// arrive as a transport error, indistinguishable from a dead backend, because the branch meant to
// catch it tested for a `DOMException` that axios does not throw.

const cancelled = () =>
  Object.assign(new Error('canceled'), {
    isAxiosError: true,
    name: 'CanceledError',
    code: 'ERR_CANCELED',
    config: { url: '/test' },
  })

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

const listSetup = (get: ReturnType<typeof vi.fn>, cancelPrevious = false) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
  const { pagination } = usePagination('id')
  const api = useApiFetchList<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
    urlTemplate: '/items',
    cancelPrevious,
  })

  return { ...api, pagination, filterData, filterConfig }
}

const listPage = (data: Array<{ id: number }>, totalCount = data.length) => ({
  status: 200,
  data: { data, totalCount },
})

beforeEach(() => {
  setActivePinia(createPinia())
  setApiErrorLogger(null)
})

describe('a request the caller stopped', () => {
  it('rejects with a class of its own, not as a transport failure', async () => {
    const { execute } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request: vi.fn().mockRejectedValue(cancelled()) }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiCancelledError)
    await expect(execute()).rejects.not.toBeInstanceOf(AnzuApiAxiosError)
  })

  it('is never written to the log', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const { execute } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request: vi.fn().mockRejectedValue(cancelled()) }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    await expect(execute()).rejects.toBeInstanceOf(AnzuApiCancelledError)

    expect(logged).not.toHaveBeenCalled()
  })
})

describe('how a request gets stopped', () => {
  it('aborts what the instance has in flight', async () => {
    let seen: AbortSignal | undefined
    const request = vi.fn().mockImplementation((config: { signal: AbortSignal }) => {
      seen = config.signal
      return new Promise(() => {})
    })
    const { execute, abort } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    void execute()
    expect(seen?.aborted).toBe(false)

    abort()

    expect(seen?.aborted).toBe(true)
  })

  it('takes a signal the caller already owns', async () => {
    let seen: AbortSignal | undefined
    const request = vi.fn().mockImplementation((config: { signal: AbortSignal }) => {
      seen = config.signal
      return new Promise(() => {})
    })
    const { execute } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })
    const outside = new AbortController()

    void execute({ signal: outside.signal })
    expect(seen?.aborted).toBe(false)

    outside.abort()

    expect(seen?.aborted).toBe(true)
  })

  it('stops a call whose signal was already aborted before it started', async () => {
    let seen: AbortSignal | undefined
    const request = vi.fn().mockImplementation((config: { signal: AbortSignal }) => {
      seen = config.signal
      return new Promise(() => {})
    })
    const { execute } = useApiRequest<Record<string, unknown>>({
      client: () => ({ request }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })
    const outside = new AbortController()
    outside.abort()

    void execute({ signal: outside.signal })

    expect(seen?.aborted).toBe(true)
  })

  it('does nothing when asked to abort after the call settled', async () => {
    const { execute, abort } = useApiRequest<Record<string, unknown>>({
      client: () =>
        ({ request: vi.fn().mockResolvedValue({ status: 200, data: { id: 1 } }) }) as unknown as AxiosInstance,
      method: 'get',
      system: 'test',
      entity: 'test',
      urlTemplate: '/test',
    })

    await expect(execute()).resolves.toStrictEqual({ id: 1 })

    expect(() => abort()).not.toThrow()
  })
})

describe('cancelPrevious, the autocomplete shape', () => {
  it('stops the earlier call before the later one registers', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)
      return new Promise(() => {})
    })
    const { execute, pagination, filterData, filterConfig } = listSetup(get, true)

    void execute(pagination, filterData, filterConfig)
    void execute(pagination, filterData, filterConfig)

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('leaves the earlier call alone without it', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)
      return new Promise(() => {})
    })
    const { execute, pagination, filterData, filterConfig } = listSetup(get, false)

    void execute(pagination, filterData, filterConfig)
    void execute(pagination, filterData, filterConfig)

    expect(signals[0].aborted).toBe(false)
  })
})

describe('what a superseded list call may still write', () => {
  // Aborting does not stop a response that is already on its way back. Without a generation check
  // the slower answer lands last and the pagination describes a query nobody is looking at.
  it('does not write pagination once a newer call has started', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    const get = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => Promise.resolve(listPage([{ id: 2 }], 99)))
    const { execute, pagination, filterData, filterConfig } = listSetup(get)

    const first = execute(pagination, filterData, filterConfig)
    await execute(pagination, filterData, filterConfig)
    expect(pagination.value.totalCount).toBe(99)

    resolveFirst?.(listPage([{ id: 1 }], 11))
    await first

    expect(pagination.value.totalCount).toBe(99)
  })

  // It still answers its own caller, though -- it succeeded, it was simply overtaken.
  it('still resolves with its own data', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    const get = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => Promise.resolve(listPage([{ id: 2 }], 99)))
    const { execute, pagination, filterData, filterConfig } = listSetup(get)

    const first = execute(pagination, filterData, filterConfig)
    await execute(pagination, filterData, filterConfig)
    resolveFirst?.(listPage([{ id: 1 }], 11))

    await expect(first).resolves.toStrictEqual([{ id: 1 }])
  })

  it('does not write pagination after the instance was aborted', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    const get = vi.fn().mockImplementation(() => new Promise((resolve) => (resolveFirst = resolve)))
    const { execute, abort, pagination, filterData, filterConfig } = listSetup(get)
    const before = pagination.value.totalCount

    const first = execute(pagination, filterData, filterConfig)
    abort()
    resolveFirst?.(listPage([{ id: 1 }], 77))
    await first

    expect(pagination.value.totalCount).toBe(before)
  })

  // The counter belongs to the instance, so an external signal must not touch it: cancelling an
  // older call would otherwise discard the newest call's write.
  it('lets the newest call write even when an older one is cancelled from outside', async () => {
    const older = new AbortController()
    const get = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => Promise.resolve(listPage([{ id: 2 }], 42)))
    const { execute, pagination, filterData, filterConfig } = listSetup(get)

    void execute(pagination, filterData, filterConfig, { signal: older.signal })
    older.abort()
    await execute(pagination, filterData, filterConfig)

    expect(pagination.value.totalCount).toBe(42)
  })
})
