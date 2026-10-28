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
