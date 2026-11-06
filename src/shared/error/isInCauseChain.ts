import { isDefined, isNull } from '@/shared/utils/common'

/**
 * Checks whether any value in an error's `.cause` chain matches.
 * A cause is not always an `Error`, and a chain can loop.
 */
export const isInCauseChain = (error: unknown, predicate: (value: unknown) => boolean): boolean => {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (isDefined(current) && !isNull(current) && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}
