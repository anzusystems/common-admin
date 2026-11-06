import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'
import type { IntegerId } from '@/shared/types/common'

export interface DamExtSystem extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: IntegerId
  name: string
  slug: string
  adminUsers: IntegerId[]
}

export interface DamExtSystemMinimal extends Pick<DamExtSystem, 'id' | 'name'> {}
