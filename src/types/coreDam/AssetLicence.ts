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

export interface DamAssetLicenceSelectFields {
  badge: string
}

export type DamAssetLicenceCached = DamAssetLicenceMinimal & DamAssetLicenceSelectFields

export interface DamAssetLicenceExtended extends DamAssetLicence, DamAssetLicenceSelectFields {}
