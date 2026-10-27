import type { AxiosClientFn } from '@/domains/api/utils/client'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { isNull, isString, isUndefined } from '@/shared/utils/common'
import { ref, type Ref } from 'vue'

/**
 * Whether the response carries a body.
 * axios returns `''` when no bytes arrived, so a 204 and a body-less 200
 * both arrive as `''`. `0` and `false` are real values and count as a body.
 * `null` is treated as absent too, because the response type excludes `null`.
 */
export const hasBody = (res: { data: unknown }): boolean =>
  !isUndefined(res.data) && !isNull(res.data) && res.data !== ''

/**
 * Strips the helper-owned keys from the caller's `options` at runtime.
 * The type forbids them, but without this `data` survived the
 * spread when no body was passed, which allowed a body on a GET.
 */
const HELPER_OWNED = ['method', 'url', 'data', 'signal'] as const

export const ownedByHelper = <T extends object>(options: T): Omit<T, (typeof HELPER_OWNED)[number]> => {
  const rest = { ...options } as Record<string, unknown>
  for (const key of HELPER_OWNED) delete rest[key]

  return rest as Omit<T, (typeof HELPER_OWNED)[number]>
}

/**
 * Renders a config axios kept. It has no `baseURL` or `params`
 * of its own, so the output is only what the config carries.
 * Created lazily so importing the library does not create an axios instance.
 * Consumers that mock axios and count `create` calls would see an extra one.
 */
let rendererInstance: AxiosInstance | undefined
const renderer = (): AxiosInstance => (rendererInstance ??= axios.create())

/**
 * The url as axios actually requests it, rendered by axios itself. An approximation
 * renders arrays, nested objects and dates differently from the wire.
 * `undefined` in gives `undefined` out. A call that failed before it had a url has none, and
 * axios would answer with the client root. An empty string is a real root url and is rendered.
 * Prefers the config axios kept on the error or response, since it reflects merging and
 * interceptor rewrites. It is rendered through a defaults-free instance, because `getUri`
 * merges instance defaults under the config. Only the rebuild goes through the client.
 * Never throws. It runs inside the catch, and a client without `getUri` (a
 * stub or mock) must not replace the original error with a `TypeError`.
 */
export const requestedUrl = (
  client: AxiosClientFn,
  url: string | undefined,
  options: AxiosRequestConfig = {},
  failure?: unknown,
  dispatched?: AxiosRequestConfig
): string | undefined => {
  if (isUndefined(url)) return undefined

  try {
    const sent = (axios.isAxiosError(failure) ? failure.config : undefined) ?? dispatched
    const built: unknown = isUndefined(sent)
      ? client().getUri({ ...ownedByHelper(options), url })
      : renderer().getUri(sent)

    // A stub can answer with anything. The declared type says string, so it has to be one.
    return isString(built) ? built : url
  } catch {
    return url
  }
}

export type Abortable = {
  /** Runs one call with a signal of its own, registered so `abort()` can reach it. */
  run: <T>(fn: (signal: AbortSignal, generation: number) => Promise<T>, external?: AbortSignal) => Promise<T>
  /** Stops every call this instance still has in flight. */
  abort: () => void
  /** The generation a call starts in; a stale one must not write to state the caller can see. */
  generation: () => number
  loading: Ref<boolean>
}

export type AbortableOptions = {
  /**
   * Each call supersedes the previous one. The abort happens before the new
   * call registers, so the latest call always wins regardless of interleaving.
   */
  cancelPrevious?: boolean
}

export const createAbortable = (options: AbortableOptions = {}): Abortable => {
  const { cancelPrevious = false } = options
  const controllers = new Set<AbortController>()
  let generation = 0

  /**
   * Derived from the in-flight set, not counted, so it is safe with `cancelPrevious`.
   * A caller-cleared `finally` flag would turn off when the superseded call ends. Here
   * the old controller leaves the set as the new one joins, so the value never dips.
   */
  const loading = ref(false)
  const syncLoading = () => {
    loading.value = controllers.size > 0
  }

  const abortAll = () => {
    controllers.forEach((controller) => controller.abort())
    controllers.clear()
  }

  const run = async <T>(
    fn: (signal: AbortSignal, generation: number) => Promise<T>,
    external?: AbortSignal
  ): Promise<T> => {
    // Before the new controller is registered, or the abort would take the new call with it.
    if (cancelPrevious) abortAll()

    generation += 1
    const controller = new AbortController()
    controllers.add(controller)
    syncLoading()

    // The external signal is relayed, not passed through, because `abort()` can only reach controllers this set owns.
    const relay = () => controller.abort()
    if (external) {
      if (external.aborted) controller.abort()
      else external.addEventListener('abort', relay, { once: true })
    }

    try {
      return await fn(controller.signal, generation)
    } catch (err: unknown) {
      // One call can have several requests under its signal (the batch
      // sends a page set at once). When one fails, abort the rest now.
      // The `finally` below drops the controller from the set, so a later `abort()` could no longer reach them.
      controller.abort()
      throw err
    } finally {
      external?.removeEventListener('abort', relay)
      controllers.delete(controller)
      syncLoading()
    }
  }

  return {
    run,
    abort: () => {
      // Bumped so a call already on its way back cannot write to the caller's state afterwards.
      generation += 1
      abortAll()
      syncLoading()
    },
    generation: () => generation,
    loading,
  }
}
