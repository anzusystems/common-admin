import type { DocId, IntegerId } from '@/types/common'

export const WIDGET_HTML_ID_PREFIX = 'a-sortable-'

export interface SortableItemDataAware {
  id?: DocId | IntegerId
  position: number
}

export interface SortableItemWithParentDataAware {
  id: DocId | IntegerId
  position: number
  parent: DocId | IntegerId | null // if null, no parent
}

export interface SortableItemNewPosition {
  id?: DocId | IntegerId
  position: number
}

export type SortableItemNewPositions = Array<SortableItemNewPosition>
