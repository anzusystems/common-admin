import type { AxiosClientFn } from '@/labs/api/client'
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { isNull, isString, isUndefined } from '@/utils/common'
import { ref, type Ref } from 'vue'

/**
 * Whether the response carries a body at all.
 *
 * `''` is not an empty document, it is what axios hands back when no bytes arrived: its adapter
 * returns `responseText`, and `transformResponse` only attempts `JSON.parse` when the string is
 * truthy, so a 204 and a body-less 200 both arrive as `''`. `0` and `false` do parse and are real
 * values -- reading them as absent is the bug this replaces.
 *
 * `null` is treated as absent too. It is distinguishable from `''` at runtime, but nothing can carry
 * it in the type: the response type excludes `null` so that a command site cannot declare itself as
 * returning one.
 */
export const hasBody = (res: { data: unknown }): boolean =>
  !isUndefined(res.data) && !isNull(res.data) && res.data !== ''

/**
 * Strips what the helper decides from whatever the caller passed as `options`.
 *
 * The type says these cannot be set, but a type says nothing at runtime: `data` in particular
 * survived the spread whenever no body was passed, so a caller could put a body on a GET through
 * the back door and skip the serialisation with it.
 */
const HELPER_OWNED = ['method', 'url', 'data', 'signal'] as const

export const ownedByHelper = <T extends object>(options: T): Omit<T, (typeof HELPER_OWNED)[number]> => {
  const rest = { ...options } as Record<string, unknown>
  for (const key of HELPER_OWNED) delete rest[key]

  return rest as Omit<T, (typeof HELPER_OWNED)[number]>
}

/**
 * Renders a config axios kept, and nothing else. It has no `baseURL` and no `params` of its own, so
 * what comes out is what the config carries.
 *
 * Built on first use rather than at module load: importing this library should not create an axios
 * instance. A consumer that mocks axios and counts `create` calls would otherwise see one it never
 * made -- which is exactly how this was found, in a fleet test asserting that its own client is
 * built once.
 */
let rendererInstance: AxiosInstance | undefined
const renderer = (): AxiosInstance => (rendererInstance ??= axios.create())

/**
 * The url as axios will actually request it: the client's `baseURL` and default `params`, the
 * request's own `params`, and whatever `paramsSerializer` renders them.
 *
 * Built by axios itself rather than approximated: a url recorded before the call is not the one
 * that went out, and an approximation renders arrays, nested objects and dates differently from the
 * wire -- which is worse than no url, because it looks findable and is not. It is handed the same
 * config the request was given, minus what this helper owns, for the same reason: a call carrying
 * its own `paramsSerializer` or `baseURL` is asking for a url that the defaults do not produce.
 *
 * `undefined` in, `undefined` out: a call that failed before it had a url has none to report, and
 * asking axios for one would answer with the client's root -- a url that was never requested and
 * that reads like an endpoint. An empty string is different: that is a call whose url really is the
 * client root, and it gets rendered.
 *
 * Rendered from the config axios actually used whenever there is one: the one it keeps on its own
 * error, or the one it keeps on the response it did return, which covers the failures the helper
 * raises itself after reading that response. Both are the request as it went out -- merged, and past
 * any request interceptor that rewrote the url or the params -- while anything rebuilt here is a
 * reconstruction, and by the time a failure is described the factory may hand back a different
 * instance or its defaults may have moved on.
 *
 * A config that axios kept is rendered through an instance with no defaults of its own, for that
 * same reason: `getUri` merges the instance's defaults *under* the config it is given, so rendering
 * it through the caller's client would let a default added since the request appear in a url that
 * never carried it. The rebuild is the one case that does want those defaults -- there is no record
 * of the request to read them from -- so it goes through the client.
 *
 * Never throws. It runs on every failure path, inside the catch, so an exception here would replace
 * the error the caller is waiting for with one about building a diagnostic string -- and a client
 * without `getUri` (a hand-built stub, a mock) must not turn a mapped failure into a `TypeError`.
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
  /** Whether this instance has anything in flight. */
  loading: Ref<boolean>
}

export type AbortableOptions = {
  /**
   * Each call supersedes the one before it. The abort happens before the new call registers, so
   * "the latest wins" holds by construction rather than by how the two calls happen to interleave.
   */
  cancelPrevious?: boolean
}

export const createAbortable = (options: AbortableOptions = {}): Abortable => {
  const { cancelPrevious = false } = options
  const controllers = new Set<AbortController>()
  let generation = 0

  /**
   * True while this instance has a request in flight.
   *
   * It is derived from the set rather than counted, which is what makes it safe to turn
   * `cancelPrevious` on. The pattern everywhere in the fleet is a `loading` ref the caller clears in
   * a `finally`, and under `cancelPrevious` that `finally` belongs to the call that was just
   * superseded -- so the spinner goes out while the call the user is waiting for is still running.
   * Here the superseded call's controller leaves the set at the same moment the new one joins it, so
   * the value never dips between the two.
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

    // The external signal is relayed rather than passed through: `abort()` has to keep working, and
    // it can only reach a controller this set owns.
    const relay = () => controller.abort()
    if (external) {
      if (external.aborted) controller.abort()
      else external.addEventListener('abort', relay, { once: true })
    }

    try {
      return await fn(controller.signal, generation)
    } catch (err: unknown) {
      // A call can have more than one request under its signal -- the batch sends a page set at
      // once -- and when one of them fails the rest are work nobody is waiting for any more. Stop
      // them here, while the controller is still reachable: the `finally` below drops it from the
      // set, and after that a later `abort()` has nothing to abort them with.
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
