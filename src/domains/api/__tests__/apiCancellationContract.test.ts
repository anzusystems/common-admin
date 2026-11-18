import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { createFilter, createFilterStore, type MakeFilterOption } from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'

// Stopping a request is ordinary (another keystroke in an autocomplete, a route change during a list load),
// so it must be distinguishable from a failed request.
// It used to arrive as a transport error because the catching
// branch tested for a `DOMException` that axios does not throw.

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

const listSetupNoTemplate = (get: ReturnType<typeof vi.fn>, cancelPrevious = false) => {
  const store = createFilterStore(fields)
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'subj' })
  const { pagination } = usePagination('id')
  const api = useApiFetchList<{ id: number }>({
    client: () => ({ get }) as unknown as AxiosInstance,
    system: 'test',
    entity: 'test',
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

afterEach(() => {
  // Put it back. It is module state shared by every file this worker runs, so a test that leaves
  // its own behind decides what the next file sees.
  setApiErrorLogger(defaultApiErrorLogger)
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

  // "A newer call has started" means the moment `execute` was called, not the moment it reached the wire.
  // Resolving the template or rendering the filters can throw before
  // dispatch, and such a call still marks the previous query obsolete.
  // With the derivation above `run`, the failing call opened no
  // generation, so the older call stayed current and wrote its pagination.
  it('supersedes the earlier call even when the newer one fails before it dispatches', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    const get = vi.fn().mockImplementation(() => new Promise((resolve) => (resolveFirst = resolve)))
    const { execute, pagination, filterData, filterConfig } = listSetupNoTemplate(get)
    const before = pagination.value.totalCount

    const first = execute(pagination, filterData, filterConfig, { urlTemplate: '/items' })
    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuFatalError)

    resolveFirst?.(listPage([{ id: 1 }], 77))
    await first

    expect(pagination.value.totalCount).toBe(before)
  })

  it('stops the earlier request when the newer one fails before it dispatches', async () => {
    const signals: AbortSignal[] = []
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      signals.push(config.signal)
      return new Promise(() => {})
    })
    const { execute, filterData, filterConfig, pagination } = listSetupNoTemplate(get, true)

    void execute(pagination, filterData, filterConfig, { urlTemplate: '/items' })
    await expect(execute(pagination, filterData, filterConfig)).rejects.toBeInstanceOf(AnzuFatalError)

    expect(signals[0].aborted).toBe(true)
  })

  // The window between the response arriving and the pagination being written.
  // `run` drops the relay for the caller's signal once it has the response, and the write happens after that.
  // An abort landing in between never reaches the call's own signal, so the guard reads the caller's signal directly.
  it('does not write pagination when the caller stops it after the response has arrived', async () => {
    const own = new AbortController()
    let seen: AbortSignal | undefined
    let resolveGet: ((value: unknown) => void) | undefined
    const get = vi.fn().mockImplementation((_url: string, config: { signal: AbortSignal }) => {
      seen = config.signal

      return new Promise((resolve) => (resolveGet = resolve))
    })
    const { execute, pagination, filterData, filterConfig } = listSetup(get)
    const before = pagination.value.totalCount

    const call = execute(pagination, filterData, filterConfig, { signal: own.signal })
    resolveGet?.(listPage([{ id: 1 }], 99))
    // One tick: `run` has the response and has already dropped the relay, and the write is queued
    // behind this. Aborting here is what the relay would have caught a moment earlier.
    await Promise.resolve()
    own.abort()

    expect(seen?.aborted).toBe(false)

    await call

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
