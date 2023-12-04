import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DocId, IntegerId } from '@/types/common'

interface Flags {
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
