import type { DocId, IntegerId } from '@/shared/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'
import type { DamAuthorTypeType } from '@/domains/dam/author/types/DamAuthorType'

export interface Flags {
  reviewed: boolean
  canBeCurrentAuthor: boolean
  source: boolean
  hiddenInCredit: boolean
}

export interface DamAuthorMinimal {
  id: DocId
  name: string
  identifier: string
  reviewed: boolean
  /** Left out of the credit. Missing reads as shown. */
  hiddenInCredit?: boolean
}

export interface DamAuthor
  extends Pick<DamAuthorMinimal, 'id' | 'name' | 'identifier'>, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerId
  flags: Flags
  type: DamAuthorTypeType
  currentAuthors: DocId[]
  childAuthors: DocId[]
}
