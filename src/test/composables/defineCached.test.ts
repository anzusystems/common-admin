import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineCached } from '@/composables/system/defineCached'

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

const makeCache = (fetchCallback: (ids: number[]) => Promise<Row[]>, maxLimit = 1000) =>
  defineCached<number, Row, ReturnType<typeof mapFullToMinimal>>(
    mapFullToMinimal,
    mapIdToMinimal,
    fetchCallback,
    'id',
    maxLimit,
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
