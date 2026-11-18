import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'

export interface DamAssetLicenceGroup extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: IntegerId
  name: string
  extSystem: IntegerIdNullable
  licences: IntegerId[]
}
