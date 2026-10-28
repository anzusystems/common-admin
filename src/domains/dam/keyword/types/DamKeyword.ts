import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'
import type { DocId, IntegerId } from '@/shared/types/common'

export interface Flags {
  reviewed: boolean
}

export interface DamKeyword extends AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  id: DocId
  name: string
  extSystem: IntegerId
  flags: Flags
}

export interface DamKeywordMinimal {
  id: DocId
  name: string
}
