import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineCached, type DefineCachedOptions } from '@/domains/cached/composables/defineCached'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }))
vi.mock('@/domains/system/composables/sentry', () => ({ useSentry: () => ({ logError }) }))

// A failed cache fetch used to leave its ids in the queue forever, so the very same
// failing batch was resent on every subsequent fetch() (observed in production as one
// 403 batch retried for hours) while the item stayed _loaded: false and its chip spun
// until reload. These tests pin the state machine: the queue always drains, whatever the
// fetch did not resolve becomes terminal, and pruning only counts ids that actually grow
// the cache.

interface Row {
  id: number
  name: string
}

const mapFullToMinimal = (row: Row) => ({ id: row.id, name: row.name })
const mapIdToMinimal = (id: number) => ({ id, name: '' })

const makeCache = (
  fetchCallback: (ids: number[]) => Promise<Row[]>,
  maxLimit = 1000,
  options: DefineCachedOptions = {}
) =>
  defineCached<number, Row, ReturnType<typeof mapFullToMinimal>>(
    mapFullToMinimal,
    mapIdToMinimal,
    fetchCallback,
    'id',
    maxLimit,
    options
  )

describe('defineCached', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('drains the queue and marks the items unresolved when the fetch fails', async () => {
    const fetchCallback = vi.fn(async () => {
      throw new Error('403')
    })
    const { add, immediateFetch, cache, toFetch, isUnresolved, isLoaded } = makeCache(fetchCallback)

    add(1, 2)
    await expect(immediateFetch()).rejects.toThrow('403')

    expect(toFetch.value.size).toBe(0)
    expect(cache.value.get(1)?._unresolved).toBe(true)
    expect(isUnresolved(1)).toBe(true)
    expect(isLoaded(1)).toBe(false)
  })

  it('does not resend a batch that already failed', async () => {
    const fetchCallback = vi.fn(async () => {
      throw new Error('403')
    })
    const { add, immediateFetch } = makeCache(fetchCallback)

    add(1)
    await expect(immediateFetch()).rejects.toThrow('403')
    await expect(immediateFetch()).resolves.toEqual([])

    expect(fetchCallback).toHaveBeenCalledTimes(1)
  })

  it('marks ids the server did not return as unresolved', async () => {
    const fetchCallback = vi.fn(async () => [{ id: 1, name: 'kept' }])
    const { add, immediateFetch, isLoaded, isUnresolved } = makeCache(fetchCallback)

    add(1, 2)
    await immediateFetch()

    expect(isLoaded(1)).toBe(true)
    expect(isUnresolved(1)).toBe(false)
    expect(isLoaded(2)).toBe(false)
    expect(isUnresolved(2)).toBe(true)
  })

  it('re-queues an unresolved id when it is added again', async () => {
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce([{ id: 1, name: 'recovered' }])
    const { add, immediateFetch, isLoaded, isUnresolved } = makeCache(fetchCallback)

    add(1)
    await expect(immediateFetch()).rejects.toThrow('503')
    expect(isUnresolved(1)).toBe(true)

    add(1)
    await immediateFetch()

    expect(isLoaded(1)).toBe(true)
    expect(isUnresolved(1)).toBe(false)
  })

  it('does not reject from the debounced fetch, because callers use it fire-and-forget', async () => {
    vi.useFakeTimers()
    try {
      const fetchCallback = vi.fn(async () => {
        throw new Error('network')
      })
      const { add, fetch, toFetch, isUnresolved } = makeCache(fetchCallback)

      add(1)
      const pending = fetch()
      await vi.advanceTimersByTimeAsync(1600)

      // Awaiting is the assertion: a rejection here would fail the test and, in the app,
      // surface as an unhandled rejection. The resolved value is not pinned on purpose,
      // vueuse settles a superseded debounce call with undefined.
      await pending
      expect(fetchCallback).toHaveBeenCalledTimes(1)
      expect(toFetch.value.size).toBe(0)
      expect(isUnresolved(1)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('evicts only as many entries as the genuinely new ids require', () => {
    const { add, addManual, cache } = makeCache(async () => [], 3)

    addManual({ id: 1, name: 'a' })
    addManual({ id: 2, name: 'b' })
    addManual({ id: 3, name: 'c' })
    expect(cache.value.size).toBe(3)

    add(4)

    expect(cache.value.size).toBe(3)
    expect(cache.value.has(4)).toBe(true)
    expect(cache.value.has(1)).toBe(false)
  })

  it('does not evict anything when the added ids are already cached', async () => {
    const fetchCallback = vi.fn(async () => {
      throw new Error('403')
    })
    const { add, addManual, immediateFetch, cache } = makeCache(fetchCallback, 3)

    add(1)
    await expect(immediateFetch()).rejects.toThrow('403')
    addManual({ id: 2, name: 'b' })
    addManual({ id: 3, name: 'c' })
    expect(cache.value.size).toBe(3)

    // Re-adding the unresolved id sets an existing key, so it must not count as growth.
    add(1)

    expect(cache.value.size).toBe(3)
    expect(cache.value.has(2)).toBe(true)
    expect(cache.value.has(3)).toBe(true)
  })
})

// Why an id stayed unresolved decides whether the next `add()` asks again: a 403 or a missing user
// asked for on every page that shows it was a request (and, for the 403, an error) per view.
describe('defineCached — unresolved reasons, the queue and logging', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logError.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not queue falsy ids, as get/has/isLoaded do not count them', () => {
    const { add, cache, toFetch } = makeCache(async () => [])

    add(0, null, undefined)
    add([0, null, 1])

    expect(Array.from(toFetch.value)).toEqual([1])
    expect(cache.value.has(0)).toBe(false)
  })

  it('does not send an id again while its batch is still in flight', async () => {
    let resolveFirst: (rows: Row[]) => void = () => {}
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce([{ id: 2, name: 'two' }])
    const { add, immediateFetch, isLoaded } = makeCache(fetchCallback)

    add(1)
    const first = immediateFetch()
    add(1, 2)
    const second = immediateFetch()
    resolveFirst([{ id: 1, name: 'one' }])
    await first

    expect(fetchCallback).toHaveBeenNthCalledWith(1, [1])
    expect(fetchCallback).toHaveBeenNthCalledWith(2, [2])
    // The second call no longer sends 1, and still answers with it: a caller reading the result to
    // add the relations of what it fetched would otherwise miss the items of the batch in flight.
    expect((await second).map((row) => row.id).sort()).toEqual([1, 2])
    expect(isLoaded(1)).toBe(true)
    expect(isLoaded(2)).toBe(true)
  })

  it('does not ask again for a forbidden id', async () => {
    const fetchCallback = vi.fn(async () => {
      throw new AnzuApiForbiddenError()
    })
    const { add, immediateFetch, cache, toFetch } = makeCache(fetchCallback)

    add(1)
    await expect(immediateFetch()).rejects.toBeInstanceOf(AnzuApiForbiddenError)
    add(1)

    expect(cache.value.get(1)?._unresolvedReason).toBe('forbidden')
    expect(toFetch.value.size).toBe(0)
  })

  it('reads a 403 status as forbidden, and a 404 of the whole request as a failure', async () => {
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockRejectedValueOnce(new AnzuApiResponseCodeError(403))
      .mockRejectedValueOnce(new AnzuApiResponseCodeError(404))
    const { add, immediateFetch, cache } = makeCache(fetchCallback)

    add(1)
    await expect(immediateFetch()).rejects.toThrow()
    add(2)
    await expect(immediateFetch()).rejects.toThrow()

    expect(cache.value.get(1)?._unresolvedReason).toBe('forbidden')
    // A list answers an id it does not have with an empty result; a 404 is a route or a proxy.
    expect(cache.value.get(2)?._unresolvedReason).toBe('error')
  })

  it('asks again for an id the server did not return, unless the cache opted out', async () => {
    const retrying = makeCache(async () => [])
    retrying.add(1)
    await retrying.immediateFetch()
    expect(retrying.cache.value.get(1)?._unresolvedReason).toBe('notFound')
    retrying.add(1)
    expect(retrying.toFetch.value.has(1)).toBe(true)

    const final = makeCache(async () => [], 1000, { retryNotFound: false })
    final.add(1)
    await final.immediateFetch()
    final.add(1)
    expect(final.toFetch.value.size).toBe(0)
    expect(final.isUnresolved(1)).toBe(true)
  })

  it('asks again after a failure that is neither forbidden nor not found', async () => {
    const fetchCallback = vi.fn(async () => {
      throw new AnzuApiResponseCodeError(503)
    })
    const { add, immediateFetch, cache, toFetch } = makeCache(fetchCallback, 1000, { retryNotFound: false })

    add(1)
    await expect(immediateFetch()).rejects.toThrow()
    expect(cache.value.get(1)?._unresolvedReason).toBe('error')
    add(1)

    expect(toFetch.value.has(1)).toBe(true)
  })

  it.each([
    ['a 403', () => new AnzuApiForbiddenError()],
    ['a 401', () => new AnzuApiResponseCodeError(401)],
    ['a cancelled request', () => new AnzuApiCancelledError(new Error('stopped'))],
    ['an expired session', () => new AnzuApiResponseCodeError(0, new SessionExpiredError())],
    ['an auth service that did not answer', () => new AnzuApiResponseCodeError(0, new AuthUnavailableError(null))],
  ])('does not write down %s', async (_, failure) => {
    vi.useFakeTimers()
    try {
      const { add, fetch } = makeCache(async () => {
        throw failure()
      })
      add(1)
      void fetch()
      await vi.advanceTimersByTimeAsync(1600)
      expect(logError).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ['a timeout', () => new AnzuApiTimeoutError(new Error('timeout'))],
    ['a 5xx', () => new AnzuApiResponseCodeError(500)],
    ['a failing mapper', () => new TypeError('mapper')],
  ])('writes down %s', async (_, failure) => {
    vi.useFakeTimers()
    try {
      const { add, fetch } = makeCache(async () => {
        throw failure()
      })
      add(1)
      void fetch()
      await vi.advanceTimersByTimeAsync(1600)
      expect(logError).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('settles the ids of a callback that throws before it returns a promise', async () => {
    const { add, immediateFetch, isUnresolved, toFetch } = makeCache(() => {
      throw new Error('sync')
    })

    add(1)
    await expect(immediateFetch()).rejects.toThrow('sync')

    expect(isUnresolved(1)).toBe(true)
    expect(toFetch.value.size).toBe(0)
  })

  it('rejects for its own batch and leaves the batch in flight to fill the cache', async () => {
    let resolveFirst: (rows: Row[]) => void = () => {}
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)))
      .mockRejectedValueOnce(new AnzuApiResponseCodeError(503))
    const { add, immediateFetch, isLoaded, isUnresolved } = makeCache(fetchCallback)

    add(1)
    const first = immediateFetch()
    add(2)
    const second = immediateFetch()
    await expect(second).rejects.toThrow()
    resolveFirst([{ id: 1, name: 'one' }])
    await first

    expect(isLoaded(1)).toBe(true)
    expect(isUnresolved(2)).toBe(true)
  })

  it('answers with its own items when the batch in flight fails, without rejecting', async () => {
    let rejectFirst: (error: unknown) => void = () => {}
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockImplementationOnce(() => new Promise<Row[]>((_, reject) => (rejectFirst = reject)))
      .mockResolvedValueOnce([{ id: 2, name: 'two' }])
    const { add, immediateFetch, isUnresolved } = makeCache(fetchCallback)

    add(1)
    const first = immediateFetch()
    add(2)
    const second = immediateFetch()
    rejectFirst(new AnzuApiResponseCodeError(503))
    await expect(first).rejects.toThrow()

    expect((await second).map((row) => row.id)).toEqual([2])
    expect(isUnresolved(1)).toBe(true)
  })

  it('answers with the batch in flight when its own queue is empty', async () => {
    let resolveFirst: (rows: Row[]) => void = () => {}
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)))
    const { add, immediateFetch } = makeCache(fetchCallback)

    add(1)
    const first = immediateFetch()
    const second = immediateFetch()
    resolveFirst([{ id: 1, name: 'one' }])
    await first

    expect((await second).map((row) => row.id)).toEqual([1])
    expect(fetchCallback).toHaveBeenCalledTimes(1)
  })

  it('sends a long queue in batches of a hundred and keeps the ones loaded before a failing one', async () => {
    const fetchCallback = vi
      .fn<(ids: number[]) => Promise<Row[]>>()
      .mockImplementationOnce(async (ids) => ids.map((id) => ({ id, name: String(id) })))
      .mockRejectedValueOnce(new AnzuApiResponseCodeError(503))
    const { add, immediateFetch, isLoaded, cache } = makeCache(fetchCallback)

    add(Array.from({ length: 150 }, (_, i) => i + 1))
    await expect(immediateFetch()).rejects.toThrow()

    expect(fetchCallback).toHaveBeenCalledTimes(2)
    expect(fetchCallback.mock.calls[0]![0]).toHaveLength(100)
    expect(fetchCallback.mock.calls[1]![0]).toHaveLength(50)
    expect(isLoaded(1)).toBe(true)
    expect(isLoaded(100)).toBe(true)
    expect(cache.value.get(101)?._unresolvedReason).toBe('error')
  })

  it('writes down the failure of every batch, not only the first', async () => {
    vi.useFakeTimers()
    try {
      const fetchCallback = vi
        .fn<(ids: number[]) => Promise<Row[]>>()
        .mockRejectedValueOnce(new AnzuApiForbiddenError())
        .mockRejectedValueOnce(new AnzuApiTimeoutError(new Error('timeout')))
      const { add, fetch } = makeCache(fetchCallback)

      add(Array.from({ length: 150 }, (_, i) => i + 1))
      void fetch()
      await vi.advanceTimersByTimeAsync(1600)

      expect(fetchCallback).toHaveBeenCalledTimes(2)
      expect(logError).toHaveBeenCalledTimes(1)
      expect(logError.mock.calls[0]![0]).toBeInstanceOf(AnzuApiTimeoutError)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads a 401 as a failure worth another try once the session is back', async () => {
    const fetchCallback = vi.fn(async () => {
      throw new AnzuApiResponseCodeError(401)
    })
    const { add, immediateFetch, cache, toFetch } = makeCache(fetchCallback)

    add(1)
    await expect(immediateFetch()).rejects.toThrow()
    expect(cache.value.get(1)?._unresolvedReason).toBe('error')
    add(1)

    expect(toFetch.value.has(1)).toBe(true)
  })

  it('makes room for an id supplied by hand', () => {
    const { addManual, cache } = makeCache(async () => [], 2)

    addManual({ id: 1, name: 'a' })
    addManual({ id: 2, name: 'b' })
    addManual({ id: 3, name: 'c' })

    expect(cache.value.size).toBe(2)
    expect(cache.value.has(1)).toBe(false)
    expect(cache.value.has(3)).toBe(true)
  })

  it('takes an id supplied by hand out of the queue', async () => {
    const fetchCallback = vi.fn(async () => [] as Row[])
    const { add, addManual, immediateFetch, isLoaded, toFetch } = makeCache(fetchCallback)

    add(1)
    addManual({ id: 1, name: 'by hand' })
    await immediateFetch()

    expect(toFetch.value.size).toBe(0)
    expect(fetchCallback).not.toHaveBeenCalled()
    expect(isLoaded(1)).toBe(true)
  })
})
