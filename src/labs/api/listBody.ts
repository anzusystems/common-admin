import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { isBoolean, isNumber, isObject } from '@/utils/common'
import type { Pagination } from '@/labs/filters/pagination'

export type ListBody<T> = {
  items: T[]
  /** Only what the response actually said; a missing or malformed field is simply not written. */
  pagination: Partial<Pagination>
}

/**
 * Reads a list response.
 *
 * The array is the only thing that decides whether this is a list at all. The existing shape guards
 * test for a metadata key and nothing else, so `{ totalCount: 1 }` passed as a list and the caller
 * got `undefined` typed as an array.
 *
 * Metadata only picks the mode, and is optional: a well-formed array is not worth discarding because
 * the count beside it is missing or of the wrong type. When both modes are present, `totalCount`
 * wins and `hasNextPage` is ignored, so one response cannot be read two ways.
 */
export const readListBody = <T>(body: unknown, status: number, url: string): ListBody<T> => {
  if (!isObject(body) || !Array.isArray((body as { data?: unknown }).data)) {
    throw new AnzuApiResponseCodeError(status, undefined, 'Expected a list body, url: ' + url)
  }

  const { data, totalCount, hasNextPage } = body as { data: T[]; totalCount?: unknown; hasNextPage?: unknown }

  if (isNumber(totalCount)) {
    return { items: data, pagination: { totalCount, hasNextPage: false } }
  }

  if (isBoolean(hasNextPage)) {
    return { items: data, pagination: { hasNextPage, totalCount: 0 } }
  }

  return { items: data, pagination: {} }
}
