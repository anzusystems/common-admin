import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'

export interface DamAssetLicenceMinimal {
  id: IntegerId
  name: string
}

export interface DamAssetLicence
  extends DamAssetLicenceMinimal, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerIdNullable
  extId: string
}

export interface DamAssetLicenceFlags {
  manualUploadAllowed: boolean
  directUseAllowed: boolean
  singleUseEnforced: boolean
}

export interface DamAssetLicenceAutoDelete {
  active: boolean
  olderThanDays: number
}

/**
 * The licence fields the image select needs on top of the minimal shape: the badge it renders, the flags
 * that decide whether an asset may be used directly, and the retention window it shows on a tile.
 */
export type DamAssetLicenceCached = DamAssetLicenceMinimal & {
  badge: string
  flags: DamAssetLicenceFlags
  autoDelete: DamAssetLicenceAutoDelete
}

export interface DamAssetLicenceExtended extends DamAssetLicence {
  badge: string
  flags: DamAssetLicenceFlags
  autoDelete: DamAssetLicenceAutoDelete
}
