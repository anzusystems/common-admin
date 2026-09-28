import { isDefined, isNull } from '@/utils/common'

/**
 * Walks an error's `.cause` chain (tolerant: a cause is not always an `Error`, and a chain could loop)
 * and answers whether any value in it matches.
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
