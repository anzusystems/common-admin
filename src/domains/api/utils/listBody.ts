import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { isBoolean, isNumber, isObject } from '@/shared/utils/common'
import type { Pagination } from '@/domains/api/composables/pagination'

export type ListBody<T> = {
  items: T[]
  /**
   * Which kind of list answered, read from the response, not inferred from `pagination`.
   * `pagination` is what to write. For an infinite list it includes `totalCount: 0` to clear counted-mode leftovers.
   * So reading the mode from `totalCount` sees a counted list of zero items. This caused a bug.
   */
  mode: 'counted' | 'infinite' | 'unknown'
  /**
   * The fields the response gave for its mode, plus the other mode's field cleared.
   * A counted body gets `hasNextPage: null`, an infinite one
   * `totalCount: 0`, so values from the previous query do not linger.
   * A missing or malformed field of the mode's own kind is not written.
   */
  pagination: Partial<Pagination>
  /**
   * Whether `totalCount` is a bound rather than a count.
   * With the backend's `bigTable` on (the default), the count is `offset
   * + limit + 1`, a look-ahead meaning "at least one more page".
   * It is the real total only when the page came back short.
   * Fine for Next/Previous navigation. Wrong for anything that computes a page count from it.
   */
  countIsBound: boolean
}

/**
 * Reads a list response.
 * Only the `data` array decides whether this is a list. Older guards checked a metadata
 * key only, so `{ totalCount: 1 }` passed and callers got `undefined` as an array.
 * Metadata only picks the mode and is optional. A valid array is kept even if the count is missing or malformed.
 * `hasNextPage` decides the mode. The infinite envelope also carries a
 * deprecated `totalCount`, and the counted one never has `hasNextPage`.
 * Reading `totalCount` first would make every infinite list counted,
 * with a look-ahead sentinel `offset + limit + 1` as its total.
 */
export const readListBody = <T>(body: unknown, status: number, url: string | undefined): ListBody<T> => {
  if (!isObject(body) || !Array.isArray((body as { data?: unknown }).data)) {
    throw new AnzuApiResponseCodeError(status, undefined, 'Expected a list body, url: ' + url)
  }

  const { data, totalCount, hasNextPage, bigTable } = body as {
    data: T[]
    totalCount?: unknown
    hasNextPage?: unknown
    bigTable?: unknown
  }

  if (isBoolean(hasNextPage)) {
    return { items: data, mode: 'infinite', pagination: { hasNextPage, totalCount: 0 }, countIsBound: false }
  }

  if (isNumber(totalCount)) {
    // `null`, not `false`. Paginators (`ADatatablePagination.vue`,
    // `ASubjectSelect.vue`) treat any non-null value as an infinite list.
    // `false` would mean "infinite, no next page": Next and Last go dead and the total shows the rows on screen.
    // `null` means the counted list has no `hasNextPage`.
    return {
      items: data,
      mode: 'counted',
      pagination: { totalCount, hasNextPage: null },
      countIsBound: bigTable === true,
    }
  }

  return { items: data, mode: 'unknown', pagination: {}, countIsBound: false }
}

/**
 * Reads a list that arrived as a bare array.
 * Separate from `readListBody` on purpose. The caller declares the shape
 * its endpoint returns and the other shape is refused, like `optionalBody`.
 * A reader accepting both shapes would let malformed answers through.
 * Returns `T[]`, not `ListBody<T>`, because there is no envelope to name a mode.
 */
export const readArrayBody = <T>(body: unknown, status: number, url: string | undefined): T[] => {
  if (!Array.isArray(body)) {
    throw new AnzuApiResponseCodeError(status, undefined, 'Expected an array body, url: ' + url)
  }

  return body as T[]
}
