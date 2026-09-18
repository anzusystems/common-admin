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

export type Abortable = {
  /** Runs one call with a signal of its own, registered so `abort()` can reach it. */
  run: <T>(fn: (signal: AbortSignal) => Promise<T>, external?: AbortSignal) => Promise<T>
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

  const run = async <T>(fn: (signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> => {
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
      return await fn(controller.signal)
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
