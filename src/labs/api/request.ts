import type { AxiosClientFn } from '@/labs/api/client'
import type { AxiosResponse } from 'axios'
import { isNull, isUndefined } from '@/utils/common'

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
export const hasBody = (res: AxiosResponse): boolean => !isUndefined(res.data) && !isNull(res.data) && res.data !== ''

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
 * The url as axios will actually request it, `options.params` and a custom `paramsSerializer`
 * included.
 *
 * Built by axios itself rather than approximated: a url recorded before the call is not the one
 * that went out, and an approximation renders arrays, nested objects and dates differently from the
 * wire -- which is worse than no url, because it looks findable and is not.
 *
 * Never throws. It runs on every failure path, inside the catch, so an exception here would replace
 * the error the caller is waiting for with one about building a diagnostic string.
 */
export const requestedUrl = (client: AxiosClientFn, url: string, params: unknown): string => {
  if (isUndefined(params) || isNull(params)) return url

  try {
    return client().getUri({ url, params })
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
    }
  }

  return {
    run,
    abort: () => {
      // Bumped so a call already on its way back cannot write to the caller's state afterwards.
      generation += 1
      abortAll()
    },
    generation: () => generation,
  }
}
