import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'

export interface DamAssetLicenceMinimal {
  id: IntegerId
  name: string
}

export interface DamAssetLicence extends DamAssetLicenceMinimal, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerIdNullable
  extId: string
}

export interface DamAssetLicenceSelectFields {
  /** Up to four characters `A-Z0-9` that mark the licence's assets, empty when it has none. */
  badge: string
}

export type DamAssetLicenceCached = DamAssetLicenceMinimal & DamAssetLicenceSelectFields

export interface DamAssetLicenceExtended extends DamAssetLicence, DamAssetLicenceSelectFields {}
