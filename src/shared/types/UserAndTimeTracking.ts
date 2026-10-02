import type { DatetimeUTCNullable, IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { AddToCachedArgs, CachedItem } from '@/domains/cached/composables/defineCached'

/**
 * What the created / modified rows read. Every field is optional: a backend without user tracking
 * leaves `createdBy` and `modifiedBy` out of its answer, one without any tracking all four.
 */
export interface UserAndTimeTrackingData {
  createdAt?: DatetimeUTCNullable
  modifiedAt?: DatetimeUTCNullable
  createdBy?: IntegerIdNullable
  modifiedBy?: IntegerIdNullable
}

/**
 * The admin's user cache, as the rows need it. Every admin's `useCachedUsers()` (and the library's
 * `useCachedAnzuUsers()`, `useDamCachedUsers()`) returns these three under these names, and every
 * admin's minimal user is a superset of `AnzuUserMinimal`.
 */
export interface UserAndTimeTrackingUsers<U extends AnzuUserMinimal = AnzuUserMinimal> {
  getCachedUser: (id: IntegerIdNullable | undefined) => CachedItem<U> | undefined
  addToCachedUsers: (...args: AddToCachedArgs<IntegerId>) => void
  fetchCachedUsers: () => unknown
}
