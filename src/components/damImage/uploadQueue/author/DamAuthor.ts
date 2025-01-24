import type { DocId, IntegerId } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { DamAuthorTypeType } from '@/components/damImage/uploadQueue/author/DamAuthorType'

export interface Flags {
  reviewed: boolean
  canBeCurrentAuthor: boolean
}

export interface DamAuthorMinimal {
  id: DocId
  name: string
  identifier: string
  reviewed: boolean
}

export interface DamAuthor
  extends Pick<DamAuthorMinimal, 'id' | 'name' | 'identifier'>,
    AnzuUserAndTimeTrackingAware,
    ResourceNameSystemAware {
  extSystem: IntegerId
  flags: Flags
  type: DamAuthorTypeType
  currentAuthors: DocId[]
  childAuthors: DocId[]
}
