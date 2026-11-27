import type { DatetimeUTCNullable, IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserMinimal } from '@/shared/types/AnzuUser'
import type { AddToCachedArgs, CachedItem } from '@/domains/cached/composables/defineCached'

/**
 * Every field is optional. A backend without user tracking omits
 * `createdBy` and `modifiedBy`; one without any tracking omits all four.
 */
export interface UserAndTimeTrackingData {
  createdAt?: DatetimeUTCNullable
  modifiedAt?: DatetimeUTCNullable
  createdBy?: IntegerIdNullable
  modifiedBy?: IntegerIdNullable
}

/**
 * The admin's user cache, as the rows need it.
 * Every admin's `useCachedUsers()`, and the library's `useCachedAnzuUsers()` and `useDamCachedUsers()`,
 * return these three members. Every admin's minimal user is a superset of `AnzuUserMinimal`.
 */
export interface UserAndTimeTrackingUsers<U extends AnzuUserMinimal = AnzuUserMinimal> {
  getCachedUser: (id: IntegerIdNullable | undefined) => CachedItem<U> | undefined
  addToCachedUsers: (...args: AddToCachedArgs<IntegerId>) => void
  fetchCachedUsers: () => unknown
}
