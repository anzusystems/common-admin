import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'

export interface DamAssetLicenceMinimal {
  id: IntegerId
  name: string
}

export interface DamAssetLicenceSelectFields {
  /** Up to four characters `A-Z0-9` that mark the licence's assets, empty when it has none. */
  badge: string
}

// `badge` is on the licence itself, as in 1.50.0. A DAM before the badge sends none, so readers fall back to ''.
export interface DamAssetLicence
  extends DamAssetLicenceMinimal, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware, DamAssetLicenceSelectFields {
  extSystem: IntegerIdNullable
  extId: string
}

export type DamAssetLicenceCached = DamAssetLicenceMinimal & DamAssetLicenceSelectFields

/** The same as `DamAssetLicence`, which carries `badge` since 1.50.0. Kept for the admins that use the name. */
export type DamAssetLicenceExtended = DamAssetLicence
