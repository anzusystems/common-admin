import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { isBoolean, isNumber, isObject } from '@/utils/common'
import type { Pagination } from '@/labs/filters/pagination'

export type ListBody<T> = {
  items: T[]
  /**
   * Which kind of list answered, read from the response rather than inferred from `pagination`.
   *
   * They are two different things and conflating them cost a bug: `pagination` is what to write, and
   * for an infinite list that includes `totalCount: 0` to clear the counted mode's leftovers -- so a
   * reader using `totalCount` to recognise the mode sees a counted list of zero items.
   */
  mode: 'counted' | 'infinite' | 'unknown'
  /**
   * What the response said about the mode it is in, plus the other mode's field cleared: a counted
   * body carries `hasNextPage: null` and an infinite one `totalCount: 0`, so a value left over from
   * the previous query cannot go on describing this one. A missing or malformed field of the mode's
   * own kind is not written at all.
   */
  pagination: Partial<Pagination>
  /**
   * Whether `totalCount` is a bound rather than a count.
   *
   * The backend's counted envelope carries `bigTable`, and with it on -- which is the default -- the
   * count it sends is `offset + limit + 1`: a look-ahead that says "there is at least one more page",
   * not how many rows exist. It is corrected to the real total only when the page came back short,
   * which is to say only when there was nothing more to look ahead to.
   *
   * Page-by-page navigation does not care: the sentinel is exactly what it needs to enable Next.
   * Anything that treats the number as a total does -- dividing by a page size to learn how many
   * pages exist yields 2, whatever the real answer is.
   */
  countIsBound: boolean
}

/**
 * Reads a list response.
 *
 * The array is the only thing that decides whether this is a list at all. The existing shape guards
 * test for a metadata key and nothing else, so `{ totalCount: 1 }` passed as a list and the caller
 * got `undefined` typed as an array.
 *
 * Metadata only picks the mode, and is optional: a well-formed array is not worth discarding because
 * the count beside it is missing or of the wrong type.
 *
 * `hasNextPage` decides, and only its absence falls through to `totalCount`. It has to be that way
 * round, because the backend's infinite envelope carries BOTH: `ApiInfiniteResponseList` serialises
 * `hasNextPage`, `data` and `totalCount` (the last marked `@deprecated`, which is a docblock and
 * suppresses nothing), while the counted one carries `totalCount`, `data` and `bigTable` and never
 * `hasNextPage`. So the presence of `hasNextPage` is the only unambiguous signal, and reading
 * `totalCount` first would turn every infinite list in the fleet into a counted one -- with a total
 * that is not a total: with `bigTable` on, which is the default, the counted number is a look-ahead
 * sentinel, `offset + limit + 1`, and the infinite envelope reports that same sentinel unconditionally.
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
    // `null`, not `false`: the field is three-valued and the paginators read it that way. `isNull`
    // is what picks the mode -- `ADatatablePagination.vue:62,67,73` and both `ASubjectSelect.vue`
    // take a non-null value to mean an infinite list, so `false` here says "infinite, and there is
    // no next page": Next and Last go dead on every page and the total renders as the number of
    // rows on screen. `null` is the counted list saying the infinite mode's field does not apply.
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
 *
 * The second of the two shapes a list comes in, and a separate reader rather than one that takes
 * either: the caller declares which one this endpoint answers with and the reader refuses the
 * other, the way `optionalBody` makes the caller declare a body. One reader accepting both shapes
 * is a permissive reader, and a permissive reader is what let a malformed answer through in the
 * first place.
 *
 * Returns `T[]` rather than `ListBody<T>`: `mode: 'unknown'` means the envelope named no mode, and
 * here there was no envelope to name one.
 */
export const readArrayBody = <T>(body: unknown, status: number, url: string | undefined): T[] => {
  if (!Array.isArray(body)) {
    throw new AnzuApiResponseCodeError(status, undefined, 'Expected an array body, url: ' + url)
  }

  return body as T[]
}
