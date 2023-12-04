import type { DocId, IntegerId } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { AuthorType } from '@/components/damImage/uploadQueue/author/AuthorType'

interface Flags {
  reviewed: boolean
}

export interface DamAuthorMinimal {
  id: DocId
  name: string
  identifier: string
}

export interface DamAuthor extends DamAuthorMinimal, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerId
  flags: Flags
  type: AuthorType
}
