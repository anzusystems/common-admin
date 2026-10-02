import type { UserAndTimeTrackingData } from '@/shared/types/UserAndTimeTracking'
import { isUndefined } from '@/shared/utils/common'

/**
 * Copies the tracking fields of a saved record onto the record a form keeps editing.
 *
 * For an update that does not put its whole answer into the store: after a save the form stays
 * open, and without this it keeps showing the modification time and user from before the save.
 * Only these four fields -- the rest of the answer can differ from what the form edits (sorted
 * lists, normalised values) and replacing it is the update's own decision. A field missing from
 * the answer (a backend without user tracking) is left as it is.
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
