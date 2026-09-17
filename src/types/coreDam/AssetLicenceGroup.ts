import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'

export interface DamAssetLicenceGroup extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: IntegerId
  name: string
  extSystem: IntegerIdNullable
  licences: IntegerId[]
}
