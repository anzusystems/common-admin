import { type Ref, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { DocId, IntegerId } from '@/types/common'
import { isArray, isNull, isUndefined } from '@/utils/common'
import { useSentry } from '@/services/sentry'

/**
 * `_unresolved` is terminal: the fetch settled without resolving the item, either because
 * it failed or because the server did not return it.
 */
export type CachedItem<T extends object> = T & { _loaded: boolean; _unresolved?: boolean }

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
) {
  const cache: Ref<Map<I, CachedItem<M>>> = ref(new Map())
  const toFetch = ref(new Set()) as Ref<Set<I>>
  const { logError } = useSentry()

  /** Unresolved items are re-queued on the next `add()`, never retried from the queue itself. */
  const isCached = (id: I) => {
    const item = cache.value.get(id)
    return !isUndefined(item) && item._unresolved !== true
  }

  const add = (...args: AddToCachedArgs<I>) => {
    const toAdd = <Set<I>>new Set()
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (isNull(arg) || isUndefined(arg)) continue
      if (isArray(arg)) {
        for (let j = 0; j < arg.length; j++) {
          const item = arg[j]
          if (isNull(item) || isUndefined(item)) continue
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

  const addManual = (data: T) => {
    if (data[idProp]) {
      cache.value.set(data[idProp] as I, {
        ...mapFullToMinimal(data),
        _loaded: true,
      })
    }
  }

  const addManualMinimal = (data: M) => {
    if (data[idProp]) {
      cache.value.set(data[idProp] as I, {
        ...data,
        _loaded: true,
      })
    }
  }

  /**
   * Drops only as many oldest terminal entries as the overflow requires; dropping every one
   * of them would send currently rendered chips back to their loading state.
   * Must include `_unresolved`, otherwise repeated failures grow the cache past `maxLimit`.
   */
  const prune = (protectedIds?: Set<I>) => {
    const overflow = cache.value.size + (protectedIds?.size ?? 0) - maxLimit
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
    for (let i = 0; i < data.length; i += 1) {
      cache.value.set(data[i][idProp] as I, {
        ...mapFullToMinimal(data[i]),
        _loaded: true,
      })
    }
  }

  const updateToFetch = (ids: Array<I>) => {
    for (let i = 0; i < ids.length; i += 1) {
      toFetch.value.delete(ids[i])
    }
  }

  const markUnresolved = (ids: Array<I>) => {
    for (let i = 0; i < ids.length; i += 1) {
      const item = cache.value.get(ids[i])
      if (isUndefined(item) || item._loaded) continue
      cache.value.set(ids[i], { ...item, _unresolved: true })
    }
  }

  async function apiFetch() {
    if (toFetch.value.size === 0) return []
    const ids = Array.from(toFetch.value)
    try {
      const res = await fetchCallback(ids)
      updateMap(res)
      return res
    } finally {
      // Always drain, otherwise a failing batch is resent on every subsequent fetch().
      updateToFetch(ids)
      markUnresolved(ids)
    }
  }

  const debouncedFetch = useDebounceFn(
    async () => {
      return await apiFetch()
    },
    1500,
    { maxWait: 5000 },
  )

  /**
   * Debounced fetch for best performance.
   * For general usage.
   *
   * Called fire-and-forget, so it never rejects. Use `immediateFetch()` to handle errors.
   */
  const fetch = () => {
    return debouncedFetch().catch((error: unknown) => {
      logError(error instanceof Error ? error : new Error(String(error)), {
        level: 'warning',
        tags: { cachedFetch: 'failed' },
      })
      return [] as T[]
    })
  }

  /**
   * Immediate fetch with no debounce and with result in promise.
   * Use for special cases.
   */
  const immediateFetch = () => {
    return apiFetch()
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
  }
}
