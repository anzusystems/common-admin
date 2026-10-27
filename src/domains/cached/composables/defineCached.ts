import { type Ref, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isArray, isUndefined } from '@/shared/utils/common'
import { useSentry } from '@/domains/system/composables/sentry'
import { apiErrorStatus } from '@/domains/api/utils/apiErrors'
import { FETCH_BY_IDS_BATCH_SIZE } from '@/domains/api/composables/useApiFetchByIds'
import { isAnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED } from '@/shared/statusCodes'

/**
 * Why a fetch settled without resolving an item:
 * - `notFound`: the server answered and the item was not among the results.
 * - `forbidden`: the user may not read it (403). Asking again in this session cannot change that.
 * - `error`: anything else. Network, timeout, 5xx, a 401 before session renewal,
 * or a 404 of the whole request (a route or proxy answering, not a missing item).
 */
export type CachedUnresolvedReason = 'notFound' | 'forbidden' | 'error'

/**
 * `_unresolved`: the fetch settled without resolving the item. `_unresolvedReason` says why.
 * Whether a later `add()` asks again depends on the reason (see `defineCached`).
 */
export type CachedItem<T extends object> = T & {
  _loaded: boolean
  _unresolved?: boolean
  _unresolvedReason?: CachedUnresolvedReason
}

export interface DefineCachedOptions {
  /**
   * Ask again on the next `add()` for an id the server did not return. Defaults
   * to `true`, because an entity can be created after the first lookup.
   * A user cache passes `false`. Otherwise an id missing from the table (a
   * system user of another backend) is requested on every page that shows it.
   */
  retryNotFound?: boolean
  /**
   * How many ids one `fetchCallback` call gets. Each call is
   * committed on its own. Defaults to `FETCH_BY_IDS_BATCH_SIZE`.
   * A backend with a lower per-request limit sets it here. Splitting inside
   * the callback would make one failing part discard the parts already loaded.
   */
  batchSize?: number
}

// A rejected 403 arrives mapped as `AnzuApiForbiddenError`, which carries no status of its own.
const isForbidden = (error: unknown) =>
  isAnzuApiForbiddenError(error) || apiErrorStatus(error) === HTTP_STATUS_FORBIDDEN

const unresolvedReason = (error: unknown): CachedUnresolvedReason => (isForbidden(error) ? 'forbidden' : 'error')

/**
 * Errors not worth logging: 403, no logged-in user (401 or a
 * session gone), auth service not answering, or an aborted request.
 * The api layer already handles logging of these. For a cache they concern the session, not the fetch.
 */
const isQuiet = (error: unknown) =>
  isForbidden(error) ||
  apiErrorStatus(error) === HTTP_STATUS_UNAUTHORIZED ||
  isInCauseChain(
    error,
    (cause) =>
      cause instanceof AnzuApiCancelledError ||
      cause instanceof SessionExpiredError ||
      cause instanceof AuthUnavailableError
  )

export type AddToCachedArgs<T extends DocId | IntegerId> =
  | Array<T | null | undefined>
  | Array<Array<T | null | undefined> | T | null | undefined>

/**
 * @template I Identifier type
 * @template T Source type
 * @template M Minimal type
 */
export function defineCached<
  I extends DocId | IntegerId,
  T extends Record<DocId | IntegerId, any>,
  M extends Record<DocId | IntegerId, any>,
>(
  mapFullToMinimal: (source: T) => M,
  mapIdToMinimal: (id: I) => M,
  fetchCallback: (ids: I[]) => Promise<T[]>,
  idProp = 'id',
  maxLimit = 1000,
  options: DefineCachedOptions = {}
) {
  const { retryNotFound = true } = options
  const batchSize =
    options.batchSize && options.batchSize >= 1 ? Math.floor(options.batchSize) : FETCH_BY_IDS_BATCH_SIZE
  const cache: Ref<Map<I, CachedItem<M>>> = ref(new Map())
  const toFetch = ref(new Set()) as Ref<Set<I>>
  // Ids currently shown, each with its show count (`pin`). The cache
  // never drops them to stay within its limit and may exceed it.
  // Dropping one turned a chip's name back into a spinner until the id was added again.
  const pinned = new Map<I, number>()
  // Settles, never rejects. A failed run still hands over what its earlier batches loaded.
  const inFlight = new Set<Promise<{ items: T[]; failures: unknown[] }>>()
  const { logError } = useSentry()

  /**
   * Unresolved items are never retried from the queue, only on the next `add()`, and only when retrying can help.
   * `error` always retries, `notFound` unless the cache opted out, `forbidden` never.
   */
  const isCached = (id: I) => {
    const item = cache.value.get(id)
    if (isUndefined(item)) return false
    if (item._unresolved !== true) return true
    if (item._unresolvedReason === 'forbidden') return true
    if (item._unresolvedReason === 'notFound') return !retryNotFound
    return false
  }

  // Falsy, not only null/undefined. `get`, `has` and `isLoaded` treat 0 and '' as no id.
  // Otherwise a blank factory record (`createdBy: 0`) is sent to the server as `filter_in[id]=0`.
  const add = (...args: AddToCachedArgs<I>) => {
    const toAdd = new Set<I>()
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (!arg) continue
      if (isArray(arg)) {
        for (let j = 0; j < arg.length; j++) {
          const item = arg[j]
          if (!item) continue
          if (!isCached(item)) toAdd.add(item)
        }
        continue
      }
      if (!isCached(arg)) toAdd.add(arg)
    }
    if (toAdd.size === 0) return
    prune(toAdd)
    toAdd.forEach((id) => {
      cache.value.set(id, {
        ...mapIdToMinimal(id),
        _loaded: false,
      })
      toFetch.value.add(id)
    })
  }

  // Remove it from the queue too. Otherwise a queued id supplied by
  // hand is still fetched, and the answer overwrites the caller's data.
  const addManual = (data: T) => {
    const id = data[idProp] as I
    if (!id) return
    prune(new Set([id]))
    cache.value.set(id, {
      ...mapFullToMinimal(data),
      _loaded: true,
    })
    toFetch.value.delete(id)
  }

  const addManualMinimal = (data: M) => {
    const id = data[idProp] as I
    if (!id) return
    prune(new Set([id]))
    cache.value.set(id, {
      ...data,
      _loaded: true,
    })
    toFetch.value.delete(id)
  }

  /**
   * Drops only as many oldest terminal entries as the overflow
   * requires. Dropping all would send rendered chips back to loading.
   * Pinned entries are never dropped.
   * Must include `_unresolved` entries, otherwise repeated failures grow the cache past `maxLimit`.
   */
  const prune = (protectedIds?: Set<I>) => {
    let incoming = 0
    if (protectedIds) {
      // Re-queued unresolved ids are already in the cache and do not grow it.
      for (const id of protectedIds) if (!cache.value.has(id)) incoming += 1
    }
    const overflow = cache.value.size + incoming - maxLimit
    if (overflow <= 0) return
    let removed = 0
    for (const [key, value] of cache.value) {
      if (removed >= overflow) break
      if (protectedIds?.has(key) || pinned.has(key)) continue
      if (value._loaded || value._unresolved) {
        cache.value.delete(key)
        removed += 1
      }
    }
  }

  const updateMap = (data: T[]) => {
    prune()
    for (const item of data) {
      cache.value.set(item[idProp] as I, {
        ...mapFullToMinimal(item),
        _loaded: true,
      })
    }
  }

  const updateToFetch = (ids: Array<I>) => {
    for (const id of ids) {
      toFetch.value.delete(id)
    }
  }

  const markUnresolved = (ids: Array<I>, reason: CachedUnresolvedReason) => {
    for (const id of ids) {
      const item = cache.value.get(id)
      if (isUndefined(item) || item._loaded) continue
      cache.value.set(id, { ...item, _unresolved: true, _unresolvedReason: reason })
    }
  }

  const fetchBatch = async (ids: I[]): Promise<T[]> => {
    try {
      // Awaited inside the `try`. A callback that throws before returning a promise
      // (e.g. an unconfigured dam client) must settle its ids too, or they spin forever.
      const res = await fetchCallback(ids)
      updateMap(res)
      markUnresolved(ids, 'notFound')
      // Prune once the batch settles. Ids in flight cannot be dropped before that.
      // Without this, a large add left the cache over its limit for good, also when the batch failed.
      prune()
      return res
    } catch (error: unknown) {
      markUnresolved(ids, unresolvedReason(error))
      prune()
      throw error
    }
  }

  // Fetches in the same batches the api helpers would use, sequentially, each committed on its own.
  // A failing batch then leaves earlier batches loaded.
  const runBatches = async (ids: I[]) => {
    const items: T[] = []
    const failures: unknown[] = []
    for (let start = 0; start < ids.length; start += batchSize) {
      try {
        items.push(...(await fetchBatch(ids.slice(start, start + batchSize))))
      } catch (error: unknown) {
        failures.push(error)
      }
    }
    return { items, failures }
  }

  /**
   * Fetches the queue; settles with what loaded and every batch's failure, never rejects.
   */
  const runQueue = async () => {
    if (toFetch.value.size === 0) return { items: [] as T[], failures: [] as unknown[] }
    const ids = Array.from(toFetch.value)
    // Drained before the request, not after. Otherwise a batch
    // started while this one is in flight resends the same ids.
    // That happens with a slow answer outlasting the debounce, the `maxWait` timer, or `immediateFetch()`.
    // Draining also keeps a failing batch from being resent.
    updateToFetch(ids)
    const run = runBatches(ids)
    inFlight.add(run)
    try {
      return await run
    } finally {
      inFlight.delete(run)
    }
  }

  async function apiFetch() {
    const { items, failures } = await runQueue()
    if (failures.length > 0) throw failures[0]
    return items
  }

  const logFailure = (error: unknown) => {
    if (isQuiet(error)) return
    logError(error instanceof Error ? error : new Error(String(error)), {
      level: 'warning',
      tags: { cachedFetch: 'failed' },
    })
  }

  // Caught inside the debounced callback, not on its returned promise.
  // The `maxWait` timer is a second invocation path whose promise
  // never reaches the caller, so a rejection there would be unhandled.
  const debouncedFetch = useDebounceFn(
    async () => {
      try {
        // Log every batch's failure, not only the first. A 403 in one would otherwise hide a timeout in the next.
        const { items, failures } = await runQueue()
        failures.forEach(logFailure)
        return items
      } catch (error: unknown) {
        logFailure(error)
        return [] as T[]
      }
    },
    1500,
    { maxWait: 5000 }
  )

  /**
   * Debounced fetch for general use.
   * Called fire-and-forget, so it never rejects. Use `immediateFetch()` to handle errors.
   */
  const fetch = () => {
    return debouncedFetch()
  }

  /**
   * Immediate fetch without debounce, returning the result.
   * Also waits for batches already in flight and includes their items, since
   * their ids are out of the queue and callers adding relations would miss them.
   * Rejects only when its own batch fails. An id whose in-flight batch
   * failed is missing from the result; check `isUnresolved(id)`.
   */
  const immediateFetch = async () => {
    const pending = Array.from(inFlight)
    const own = await apiFetch()
    const others = await Promise.all(pending)
    return [...own, ...others.flatMap((other) => other.items)]
  }

  /**
   * Marks the item of `id` as shown. The cache keeps it until a matching number of `unpin` calls.
   */
  const pin = (id: I | null | undefined) => {
    if (!id) return
    pinned.set(id, (pinned.get(id) ?? 0) + 1)
  }

  /**
   * Marks the item of `id` as no longer shown. The cache returns within its limit once no pins are left.
   */
  const unpin = (id: I | null | undefined) => {
    if (!id) return
    const count = pinned.get(id)
    if (isUndefined(count)) return
    if (count > 1) {
      pinned.set(id, count - 1)
      return
    }
    pinned.delete(id)
    prune()
  }

  const get = (id: I | null | undefined) => {
    if (!id) return undefined
    return cache.value.get(id)
  }

  const has = (id: I | null | undefined): boolean => {
    if (!id) return false
    return cache.value.has(id)
  }

  const clear = () => {
    return cache.value.clear()
  }

  const isLoaded = (id: I | null | undefined): boolean => {
    if (!id) return false
    const item = cache.value.get(id)
    if (!item) return false
    return item._loaded
  }

  /**
   * Terminal counterpart of `isLoaded`: the fetch settled without resolving the item.
   */
  const isUnresolved = (id: I | null | undefined): boolean => {
    if (!id) return false
    return cache.value.get(id)?._unresolved === true
  }

  return {
    cache,
    toFetch,
    fetch,
    immediateFetch,
    add,
    addManual,
    addManualMinimal,
    pin,
    unpin,
    has,
    get,
    clear,
    isLoaded,
    isUnresolved,
  }
}
