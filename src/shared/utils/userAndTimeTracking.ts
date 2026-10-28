import type { UserAndTimeTrackingData } from '@/shared/types/UserAndTimeTracking'
import { isUndefined } from '@/shared/utils/common'

/**
 * Copies the four tracking fields of a saved record onto the record a form keeps editing.
 * Use it for an update that does not store its whole response. The form stays
 * open after save and would otherwise show the old modification time and user.
 * Only these fields: the rest of the response can differ (sorted lists,
 * normalized values). A field missing from the response is left as is.
 */
export const syncUserAndTimeTracking = (
  target: UserAndTimeTrackingData,
  source: UserAndTimeTrackingData | null | undefined
): void => {
  // An update answered without a body (a 204) has nothing to copy.
  if (!source) return
  if (!isUndefined(source.createdAt)) target.createdAt = source.createdAt
  if (!isUndefined(source.modifiedAt)) target.modifiedAt = source.modifiedAt
  if (!isUndefined(source.createdBy)) target.createdBy = source.createdBy
  if (!isUndefined(source.modifiedBy)) target.modifiedBy = source.modifiedBy
}
