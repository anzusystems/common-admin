import type { DocId, IntegerId } from '@/types/common'

export interface SortableItemDataAware {
  id?: DocId | IntegerId
  position: number
}

export interface SortableItemNewPosition {
  id?: DocId | IntegerId
  position: number
}

export type SortableItemNewPositions = Array<SortableItemNewPosition>
