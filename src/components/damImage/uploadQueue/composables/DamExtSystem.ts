import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { IntegerId } from '@/types/common'

export interface DamExtSystem extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: IntegerId
  name: string
  slug: string
  adminUsers: IntegerId[]
}

export interface DamExtSystemMinimal extends Pick<DamExtSystem, 'id' | 'name'> {}
