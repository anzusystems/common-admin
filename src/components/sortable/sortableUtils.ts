import type { DocId, IntegerId } from '@/types/common'

export const WIDGET_HTML_ID_PREFIX = 'a-sortable-'

export interface SortableItemDataAware {
  position: number
  id: DocId | IntegerId
}

export interface SortableItemWithParentDataAware {
  position: number
  id: DocId | IntegerId
  parent: DocId | IntegerId | null // if null, no parent
}

export interface SortableItemNewPosition {
  id: DocId | IntegerId
  position: number
}

export type SortableItemNewPositions = Array<SortableItemNewPosition>
