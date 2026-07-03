import type { DocId, IntegerId } from '@/types/common'
import type {
  SortableItemDataAware,
  SortableItemNewPosition,
  SortableItemNewPositions,
  SortableItemWithParentDataAware,
} from '@/components/sortable/sortableUtils'
import type {
  SortableNested,
  SortableNestedItem,
} from '@/components/sortable/sortableNestedActions'

export type {
  SortableItemDataAware,
  SortableItemNewPosition,
  SortableItemNewPositions,
  SortableItemWithParentDataAware,
  SortableNested,
  SortableNestedItem,
}

export type ListEditorKey = DocId | IntegerId | string

export type ListEditorValidationState = 'valid' | 'invalid' | 'warning' | null

/**
 * A vuelidate `$scope` (the same value the consumer's `useVuelidate({ $scope })` collector uses).
 * Passed to an editor via `validation-scope` to auto-register the editor's aggregate row validity
 * into that collector — so a plain `v$.$invalid` save gate blocks even a collapsed invalid row.
 * Mirrors the canonical `ValidationScope` set (a `ValidationScope`-typed consumer prop assigns without
 * a cast); `false`/`undefined` opt out at runtime (the `true` case just joins the global collection).
 */
export type ListEditorValidationScope = string | number | boolean | symbol

export interface ListViewItem<TItem> {
  key: ListEditorKey
  index: number
  raw: TItem
  position?: number
  moved?: boolean
  expanded?: boolean
  editing?: boolean
  validationState?: ListEditorValidationState
}

export interface PositionHint {
  afterId?: ListEditorKey
  afterIndex?: number
  index?: number
}

export interface UseListEditorOptions {
  keyField?: string
  positionField?: string
  positionMultiplier?: number
  updatePosition?: boolean
}

export interface NestedPositionHint {
  parentId?: ListEditorKey | null
  afterId?: ListEditorKey
  afterIndex?: number
  index?: number
  asFirstChild?: boolean
  childrenAllowed?: boolean
}

/**
 * Shape-compatible with legacy SortableNestedItem but without the
 * `SortableItemWithParentDataAware` constraint — so the nested editor can
 * accept any record shape that has stable keys addressable via configurable
 * fields (keyField, positionField, parentField). Admin-cms data types like
 * `LinkedListItemKind` are assignable to this.
 */
export interface NestedTreeNode<TItem = any> {
  data: TItem
  children?: NestedTreeNode<TItem>[]
  meta: { dirty: boolean }
}

export interface NestedTree<TItem = any> {
  children: NestedTreeNode<TItem>[]
  meta: { dirty: boolean }
}
