import type { DocId, IntegerId } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DamAuthorType } from '@/components/damImage/uploadQueue/author/DamAuthorType'

export interface Flags {
  reviewed: boolean
  canBeCurrentAuthor: boolean
}

export interface DamAuthorMinimal {
  id: DocId
  name: string
  identifier: string
}

export interface DamAuthor extends DamAuthorMinimal, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerId
  flags: Flags
  type: DamAuthorType,
  currentAuthors: DocId[],
  childAuthors: DocId[]
}
