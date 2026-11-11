import type { IntegerId, IntegerIdNullable } from '@/types/common'

export interface DamAssetListViewMinimal {
  id: IntegerId
  name: string
}

// Only the current user's list views are resolved: their licences are narrowed to the ones the user may read.
export interface DamAssetListViewResolved extends DamAssetListViewMinimal {
  extSystem: IntegerId
  licences: IntegerId[]
  uploadLicence: IntegerIdNullable
}
