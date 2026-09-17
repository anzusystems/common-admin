import type { IntegerId, IntegerIdNullable } from '@/types/common'

/**
 * An asset list view as the backend resolves it for the current user: the licences are already narrowed
 * down to the ones he may read, so the client never widens the set it was given.
 */
export interface DamAssetListViewResolved {
  id: IntegerId
  name: string
  extSystem: IntegerId
  licences: IntegerId[]
  uploadLicence?: IntegerIdNullable
}
