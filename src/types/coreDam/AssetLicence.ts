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

/**
 * The licence fields the image select needs on top of the minimal shape: the badge it renders and the flags
 * that decide whether an asset may be used directly.
 */
export interface DamAssetLicenceSelectFields {
  badge: string
  flags: DamAssetLicenceFlags
}

export type DamAssetLicenceCached = DamAssetLicenceMinimal & DamAssetLicenceSelectFields

export interface DamAssetLicenceExtended extends DamAssetLicence, DamAssetLicenceSelectFields {}
