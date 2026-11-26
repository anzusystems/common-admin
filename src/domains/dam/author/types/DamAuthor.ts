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
  /** A higher priority comes first in a credit and among source badges. Missing reads as 0. */
  priority?: number
  /** Up to a few characters marking a source's assets in lists. Missing or empty shows none. */
  badge?: string
}

export interface DamAuthor
  extends Pick<DamAuthorMinimal, 'id' | 'name' | 'identifier'>, AnzuUserAndTimeTrackingAware, ResourceNameSystemAware {
  extSystem: IntegerId
  /** Since 1.53.0. A DAM before it sends none: readers take 0. */
  priority: number
  /** Since 1.53.0. A DAM before it sends none: readers take ''. */
  badge: string
  flags: Flags
  type: DamAuthorTypeType
  currentAuthors: DocId[]
  childAuthors: DocId[]
}
