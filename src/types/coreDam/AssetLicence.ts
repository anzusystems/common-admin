import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'

export interface DamAssetLicenceMinimal {
  id: IntegerId
  name: string
}

export interface DamAssetLicenceFlags {
  directUseAllowed: boolean
}

export interface DamAssetLicence
  extends DamAssetLicenceMinimal, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerIdNullable
  extId: string
  badge: string
  flags: DamAssetLicenceFlags
}

export type DamAssetLicenceCached = DamAssetLicenceMinimal &
  Pick<DamAssetLicence, 'badge' | 'flags'>
