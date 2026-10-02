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
 * - `notFound` -- the server answered and the item was not among the results,
 * - `forbidden` -- the user may not read it (403); asking again in this session cannot change that,
 * - `error` -- anything else: the network, a timeout, a 5xx, a 401 before the session is renewed, and a
 *   404 of the whole request, which is a route or a proxy answering rather than an item missing.
 */
export type CachedUnresolvedReason = 'notFound' | 'forbidden' | 'error'

/**
 * `_unresolved`: the fetch settled without resolving the item, `_unresolvedReason` says why.
 * Whether a later `add()` asks again depends on the reason (see `defineCached`).
 */
export type CachedItem<T extends object> = T & {
  _loaded: boolean
  _unresolved?: boolean
  _unresolvedReason?: CachedUnresolvedReason
}

export interface DefineCachedOptions {
  /**
   * Ask again, on the next `add()`, for an id the server did not return. Defaults to `true`: an entity
   * can be created after the first lookup. A cache of users passes `false` -- an id missing from the
   * table (a system user of another backend) would otherwise be asked for on every page showing it.
   */
  retryNotFound?: boolean
}

// A rejected 403 arrives mapped as `AnzuApiForbiddenError`, which carries no status of its own.
const isForbidden = (error: unknown) =>
  isAnzuApiForbiddenError(error) || apiErrorStatus(error) === HTTP_STATUS_FORBIDDEN

const unresolvedReason = (error: unknown): CachedUnresolvedReason => (isForbidden(error) ? 'forbidden' : 'error')

/**
 * Not a failure to write down: the user may not (403), nobody is logged in (401, or a session found
 * gone on the way out), the auth service did not answer, or the request was stopped. The api layer
 * keeps 401, 403 and an expired session out of its log itself, and writes an unavailable auth service
 * down with the request it stopped; for a cache all of them are the session, not the fetch.
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
  const cache: Ref<Map<I, CachedItem<M>>> = ref(new Map())
  const toFetch = ref(new Set()) as Ref<Set<I>>
  // Settles, never rejects: a run that failed still hands over what its earlier batches loaded.
  const inFlight = new Set<Promise<{ items: T[]; failures: unknown[] }>>()
  const { logError } = useSentry()

  /**
   * Unresolved items are never retried from the queue itself, only on the next `add()`, and only
   * when asking again can help: a failure (`error`) always, a missing item (`notFound`) unless the
   * cache opted out, a forbidden one never.
   */
  const isCached = (id: I) => {
    const item = cache.value.get(id)
    if (isUndefined(item)) return false
    if (item._unresolved !== true) return true
    if (item._unresolvedReason === 'forbidden') return true
    if (item._unresolvedReason === 'notFound') return !retryNotFound
    return false
  }

  // Falsy, not only null/undefined: `get`, `has` and `isLoaded` treat 0 and '' as no id, and a blank
  // factory record (`createdBy: 0`) would otherwise be sent to the server as `filter_in[id]=0`.
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

  // Out of the queue as well: an id added and then supplied by hand would still be fetched, and the
  // answer would overwrite what the caller just put in.
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
   * Drops only as many oldest terminal entries as the overflow requires; dropping every one
   * of them would send currently rendered chips back to their loading state.
   * Must include `_unresolved`, otherwise repeated failures grow the cache past `maxLimit`.
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
      if (protectedIds?.has(key)) continue
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
      // Awaited inside the `try`: a callback that throws before it returns a promise (a dam client
      // that is not configured) has to settle its ids too, or they would spin for good.
      const res = await fetchCallback(ids)
      updateMap(res)
      markUnresolved(ids, 'notFound')
      return res
    } catch (error: unknown) {
      markUnresolved(ids, unresolvedReason(error))
      throw error
    }
  }

  // In the batches the api helpers would split the request into anyway, one after another, each
  // committed on its own: a failing batch leaves the ones before it loaded instead of taking them along.
  const runBatches = async (ids: I[]) => {
    const items: T[] = []
    const failures: unknown[] = []
    for (let start = 0; start < ids.length; start += FETCH_BY_IDS_BATCH_SIZE) {
      try {
        items.push(...(await fetchBatch(ids.slice(start, start + FETCH_BY_IDS_BATCH_SIZE))))
      } catch (error: unknown) {
        failures.push(error)
      }
    }
    return { items, failures }
  }

  /** Fetches the queue; settles with what loaded and every batch's failure, never rejects. */
  const runQueue = async () => {
    if (toFetch.value.size === 0) return { items: [] as T[], failures: [] as unknown[] }
    const ids = Array.from(toFetch.value)
    // Drained before the request, not after it. A batch that starts while this one is in flight --
    // a slow answer outlasting the debounce, the `maxWait` timer, an `immediateFetch()` -- would
    // otherwise send the same ids again. Draining at all keeps a failing batch from being resent.
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

  // Caught inside the debounced callback, not on the promise it returns: the maxWait timer
  // is a second invocation path whose promise never reaches the caller, so a rejection
  // there would escape as an unhandled rejection.
  const debouncedFetch = useDebounceFn(
    async () => {
      try {
        // Every batch's failure, not only the first: a 403 in one would otherwise hide a timeout in
        // the next.
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
   * Debounced fetch for best performance.
   * For general usage.
   *
   * Called fire-and-forget, so it never rejects. Use `immediateFetch()` to handle errors.
   */
  const fetch = () => {
    return debouncedFetch()
  }

  /**
   * Immediate fetch with no debounce and with result in promise.
   * Use for special cases.
   *
   * Waits for the batches already in flight as well and resolves with their items: their ids are out
   * of the queue, and a caller reading the result (to add the relations of what it fetched) would miss
   * them. It rejects only when its own batch fails; an id whose batch in flight failed is not in the
   * result -- check `isUnresolved(id)` for it.
   */
  const immediateFetch = async () => {
    const pending = Array.from(inFlight)
    const own = await apiFetch()
    const others = await Promise.all(pending)
    return [...own, ...others.flatMap((other) => other.items)]
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

  /** Terminal counterpart of `isLoaded`: the fetch settled without resolving the item. */
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
    has,
    get,
    clear,
    isLoaded,
    isUnresolved,
  }
}
