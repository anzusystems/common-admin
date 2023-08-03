import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { DocId, IntegerId } from '@/types/common'
import { isArray, isNull, isUndefined } from '@/utils/common'

export type CachedItem<T extends object> = T & { _loaded: boolean }

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
  idProp = 'id'
) {
  const cache = ref<Map<I, CachedItem<M>>>(new Map())
  const toFetch = ref<Set<I>>(new Set())

  const add = (...args: AddToCachedArgs<I>) => {
    const toAdd = ref<Set<I>>(new Set())
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (isNull(arg) || isUndefined(arg)) continue
      if (isArray(arg)) {
        for (let j = 0; j < arg.length; j++) {
          const item = arg[j]
          if (isNull(item) || isUndefined(item)) continue
          if (!cache.value.has(item)) toAdd.value.add(item)
        }
        continue
      }
      if (!cache.value.has(arg)) toAdd.value.add(arg)
    }
    toAdd.value.forEach((id) => {
      cache.value.set(id, { ...mapIdToMinimal(id), ...{ _loaded: false } })
      toFetch.value.add(id)
    })
  }

  const addManual = (data: T) => {
    if (data[idProp]) {
      cache.value.set(data[idProp] as I, { ...mapFullToMinimal(data), ...{ _loaded: true } })
    }
  }

  const addManualMinimal = (data: M) => {
    if (data[idProp]) {
      cache.value.set(data[idProp] as I, { ...data, ...{ _loaded: true } })
    }
  }

  const updateMap = (data: T[]) => {
    for (let i = 0; i < data.length; i += 1) {
      cache.value.set(data[i][idProp] as I, { ...mapFullToMinimal(data[i]), ...{ _loaded: true } })
    }
  }

  const updateToFetch = (ids: Array<I>) => {
    for (let i = 0; i < ids.length; i += 1) {
      toFetch.value.delete(ids[i])
    }
  }

  async function apiFetch() {
    if (toFetch.value.size > 0) {
      const ids = Array.from(toFetch.value)
      const res = await fetchCallback(ids)
      updateToFetch(ids)
      updateMap(res)
      return res
    }
    return []
  }

  const debouncedFetch = useDebounceFn(
    async () => {
      return await apiFetch()
    },
    1500,
    { maxWait: 5000 }
  )

  /**
   * Debounced fetch for best performance.
   * For general usage.
   */
  const fetch = () => {
    return debouncedFetch()
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
    isLoaded,
  }
}
