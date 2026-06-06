import { computed, type ComputedRef, type Ref } from 'vue'
import { cloneDeep, isUndefined } from '@/utils/common'
import type {
  ListEditorKey,
  ListViewItem,
  NestedTree,
  NestedTreeNode,
  PositionHint,
} from '@/labs/listEditor/types/listEditorTypes'

export interface NestedViewItem<TItem> extends ListViewItem<TItem> {
  node: NestedTreeNode<TItem>
  depth: number
  parent: TItem | null
  parentKey: ListEditorKey | null
  childrenCount: number
  hasChildren: boolean
  childrenAllowed: boolean
  siblingIndex: number
  siblingCount: number
  firstInParent: boolean
  lastInParent: boolean
  canAddChild: boolean
  canIndent: boolean
  canOutdent: boolean
}

export interface UseNestedListEditorOptions {
  keyField?: string
  positionField?: string
  parentField?: string
  positionMultiplier?: number
  maxDepth: number
  expandedKeys?: Ref<Set<ListEditorKey>>
}

export interface NestedListEditorApi<TItem extends Record<string, any>> {
  viewItems: ComputedRef<NestedViewItem<TItem>[]>
  findNode: (id: ListEditorKey) => {
    node: NestedTreeNode<TItem> | null
    parent: NestedTreeNode<TItem> | null
  }
  addItem: (
    data: TItem,
    hint?: PositionHint & {
      parentId?: ListEditorKey | null
      asFirstChild?: boolean
      childrenAllowed?: boolean
    },
  ) => NestedTree<TItem>
  deleteItem: (id: ListEditorKey) => NestedTree<TItem>
  updateItem: (id: ListEditorKey, data: TItem, markDirty?: boolean) => NestedTree<TItem>
  moveUp: (id: ListEditorKey) => NestedTree<TItem> | null
  moveDown: (id: ListEditorKey) => NestedTree<TItem> | null
  moveTop: (id: ListEditorKey) => NestedTree<TItem> | null
  moveBottom: (id: ListEditorKey) => NestedTree<TItem> | null
  indent: (id: ListEditorKey) => NestedTree<TItem> | null
  outdent: (id: ListEditorKey) => NestedTree<TItem> | null
  moveTo: (
    id: ListEditorKey,
    targetParentId: ListEditorKey | null,
    targetIndex: number,
  ) => NestedTree<TItem> | null
  recalculatePositions: (model: NestedTree<TItem>) => NestedTree<TItem>
  calculateSubtreeDepth: (node: NestedTreeNode<TItem>) => number
}

const DEFAULT_KEY_FIELD = 'id'
const DEFAULT_POSITION_FIELD = 'position'
const DEFAULT_PARENT_FIELD = 'parent'

/**
 * Nested list editor core. Pure data behavior shared by ANestedSortableListEditor.
 * Works on a tree of `{ data, children, meta }` nodes — shape-compatible with the
 * legacy `SortableNested` wrapper so migration can pass existing data through
 * unchanged. Mutators return a cloned tree and also assign it to `model.value`.
 */
export function useNestedListEditor<TItem extends Record<string, any>>(
  model: Ref<NestedTree<TItem>>,
  options: UseNestedListEditorOptions,
): NestedListEditorApi<TItem> {
  const keyField = options.keyField ?? DEFAULT_KEY_FIELD
  const positionField = options.positionField ?? DEFAULT_POSITION_FIELD
  const parentField = options.parentField ?? DEFAULT_PARENT_FIELD
  const positionMultiplier = options.positionMultiplier ?? 1
  const maxDepth = options.maxDepth

  const getKey = (data: TItem): ListEditorKey => data[keyField] as ListEditorKey

  const calculateSubtreeDepth = (node: NestedTreeNode<TItem>): number => {
    if (!node.children || node.children.length === 0) return 1
    let max = 0
    for (const child of node.children) {
      const d = calculateSubtreeDepth(child)
      if (d > max) max = d
    }
    return max + 1
  }

  const findNode = (
    id: ListEditorKey,
    arr: NestedTreeNode<TItem>[] = model.value.children,
    parent: NestedTreeNode<TItem> | null = null,
  ): { node: NestedTreeNode<TItem> | null; parent: NestedTreeNode<TItem> | null } => {
    for (const item of arr) {
      if (getKey(item.data) === id) return { node: item, parent }
      if (item.children && item.children.length > 0) {
        const found = findNode(id, item.children, item)
        if (found.node) return found
      }
    }
    return { node: null, parent: null }
  }

  const recalculateSiblings = (siblings: NestedTreeNode<TItem>[]) => {
    let pos = 1 * positionMultiplier
    for (const sibling of siblings) {
      if (sibling.data[positionField] !== pos) {
        ;(sibling.data as any)[positionField] = pos
        // A renumbered sibling must be flagged dirty so consumers that persist
        // only changed nodes (e.g. the linked-list partial-multi save) actually
        // store the new position — otherwise add/move/delete reorders are lost on
        // reload and rows collide on their old positions.
        sibling.meta.dirty = true
      }
      pos += positionMultiplier
    }
  }

  const recalculateAll = (tree: NestedTree<TItem>) => {
    const walk = (arr: NestedTreeNode<TItem>[]) => {
      recalculateSiblings(arr)
      for (const item of arr) if (item.children && item.children.length) walk(item.children)
    }
    walk(tree.children)
  }

  const recalculatePositions = (tree: NestedTree<TItem>): NestedTree<TItem> => {
    const cloned = cloneDeep(tree) as NestedTree<TItem>
    recalculateAll(cloned)
    return cloned
  }

  const buildViewItems = (tree: NestedTree<TItem>): NestedViewItem<TItem>[] => {
    const flat: NestedViewItem<TItem>[] = []
    const expandedKeys = options.expandedKeys?.value
    let flatIndex = 0
    const walk = (
      nodes: NestedTreeNode<TItem>[],
      depth: number,
      parentNode: NestedTreeNode<TItem> | null,
    ) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const key = getKey(node.data)
        const childrenAllowed = !isUndefined(node.children)
        const hasChildren = childrenAllowed && (node.children?.length ?? 0) > 0
        const childrenCount = node.children?.length ?? 0
        const isExpanded = expandedKeys ? expandedKeys.has(key) : true
        const remainingDepth = maxDepth - (depth + 1)
        const canAddChild = childrenAllowed && remainingDepth > 0
        const canOutdent = depth > 0
        const canIndent = i > 0
        flat.push({
          key,
          index: flatIndex++,
          raw: node.data,
          position: node.data[positionField] as number | undefined,
          node,
          depth,
          parent: parentNode?.data ?? null,
          parentKey: parentNode ? getKey(parentNode.data) : null,
          childrenCount,
          hasChildren,
          childrenAllowed,
          siblingIndex: i,
          siblingCount: nodes.length,
          firstInParent: i === 0,
          lastInParent: i === nodes.length - 1,
          canAddChild,
          canIndent,
          canOutdent,
        })
        if (hasChildren && isExpanded) {
          walk(node.children as NestedTreeNode<TItem>[], depth + 1, node)
        }
      }
    }
    walk(tree.children, 0, null)
    return flat
  }

  const viewItems = computed<NestedViewItem<TItem>[]>(() => buildViewItems(model.value))

  const insertAfter = (
    siblings: NestedTreeNode<TItem>[],
    afterIdx: number,
    newNode: NestedTreeNode<TItem>,
  ) => {
    siblings.splice(afterIdx + 1, 0, newNode)
  }

  const resolveInsertIndex = (siblings: NestedTreeNode<TItem>[], hint?: PositionHint): number => {
    if (!hint) return siblings.length
    if (hint.afterId !== undefined) {
      const idx = siblings.findIndex((s) => getKey(s.data) === hint.afterId)
      return idx === -1 ? siblings.length : idx + 1
    }
    if (hint.afterIndex !== undefined) {
      if (hint.afterIndex < 0) return siblings.length
      return Math.min(hint.afterIndex + 1, siblings.length)
    }
    if (hint.index !== undefined) {
      return Math.max(0, Math.min(hint.index, siblings.length))
    }
    return siblings.length
  }

  const addItem = (
    data: TItem,
    hint?: PositionHint & {
      parentId?: ListEditorKey | null
      asFirstChild?: boolean
      childrenAllowed?: boolean
    },
  ): NestedTree<TItem> => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const childrenAllowed = hint?.childrenAllowed ?? true
    const newNode: NestedTreeNode<TItem> = {
      data: cloneDeep(data) as TItem,
      children: childrenAllowed ? [] : undefined,
      meta: { dirty: false },
    }

    let targetSiblings: NestedTreeNode<TItem>[] = cloned.children
    let parentNode: NestedTreeNode<TItem> | null = null

    if (hint?.parentId !== undefined && hint.parentId !== null) {
      const { node } = findNode(hint.parentId, cloned.children)
      if (node && node.children) {
        targetSiblings = node.children
        parentNode = node
      }
    }

    if (hint?.afterId !== undefined) {
      const { node: afterNode, parent: afterParent } = findNode(hint.afterId, cloned.children)
      if (afterNode) {
        const siblings = afterParent
          ? (afterParent.children as NestedTreeNode<TItem>[])
          : cloned.children
        const idx = siblings.indexOf(afterNode)
        if (idx !== -1) {
          insertAfter(siblings, idx, newNode)
          ;(newNode.data as any)[parentField] = afterParent ? getKey(afterParent.data) : null
          recalculateSiblings(siblings)
          model.value = cloned
          return cloned
        }
      }
    }

    const insertIdx = hint?.asFirstChild ? 0 : resolveInsertIndex(targetSiblings, hint)
    targetSiblings.splice(insertIdx, 0, newNode)
    ;(newNode.data as any)[parentField] = parentNode ? getKey(parentNode.data) : null
    recalculateSiblings(targetSiblings)
    model.value = cloned
    return cloned
  }

  const deleteItem = (id: ListEditorKey): NestedTree<TItem> => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const { node, parent } = findNode(id, cloned.children)
    if (!node) return cloned
    const siblings = parent ? (parent.children as NestedTreeNode<TItem>[]) : cloned.children
    const idx = siblings.indexOf(node)
    if (idx === -1) return cloned
    siblings.splice(idx, 1)
    recalculateSiblings(siblings)
    model.value = cloned
    return cloned
  }

  const updateItem = (id: ListEditorKey, data: TItem, markDirty = true): NestedTree<TItem> => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const { node } = findNode(id, cloned.children)
    if (!node) return cloned
    node.data = cloneDeep(data) as TItem
    // An edit IS a change that must be persisted. Consumers that save only the
    // dirty subset (e.g. linked-list partial-multi update) drop the edited node
    // otherwise, so the change is lost on reload. Mirrors add/move, which flag
    // dirty via recalculateSiblings. `markDirty=false` is for snapshot restore
    // on edit-cancel — restoring the original data must NOT flag it dirty.
    if (markDirty) node.meta.dirty = true
    model.value = cloned
    return cloned
  }

  const swapSiblings = (
    cloned: NestedTree<TItem>,
    id: ListEditorKey,
    getTargetIndex: (siblings: NestedTreeNode<TItem>[], currentIdx: number) => number | null,
  ): NestedTree<TItem> | null => {
    const { node, parent } = findNode(id, cloned.children)
    if (!node) return null
    const siblings = parent ? (parent.children as NestedTreeNode<TItem>[]) : cloned.children
    const idx = siblings.indexOf(node)
    if (idx === -1) return null
    const target = getTargetIndex(siblings, idx)
    if (target === null || target === idx) return null
    const [removed] = siblings.splice(idx, 1)
    siblings.splice(target, 0, removed)
    recalculateSiblings(siblings)
    return cloned
  }

  const moveUp = (id: ListEditorKey): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const res = swapSiblings(cloned, id, (_s, idx) => (idx > 0 ? idx - 1 : null))
    if (res) model.value = res
    return res
  }

  const moveDown = (id: ListEditorKey): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const res = swapSiblings(cloned, id, (s, idx) => (idx < s.length - 1 ? idx + 1 : null))
    if (res) model.value = res
    return res
  }

  const moveTop = (id: ListEditorKey): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const res = swapSiblings(cloned, id, (_s, idx) => (idx > 0 ? 0 : null))
    if (res) model.value = res
    return res
  }

  const moveBottom = (id: ListEditorKey): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const res = swapSiblings(cloned, id, (s, idx) => (idx < s.length - 1 ? s.length - 1 : null))
    if (res) model.value = res
    return res
  }

  /**
   * Indent: move the item under its previous sibling as its last child.
   * Fails if: no previous sibling, previous sibling doesn't allow children,
   * or the resulting depth would exceed maxDepth.
   */
  const indent = (id: ListEditorKey): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const { node, parent } = findNode(id, cloned.children)
    if (!node) return null
    const siblings = parent ? (parent.children as NestedTreeNode<TItem>[]) : cloned.children
    const idx = siblings.indexOf(node)
    if (idx <= 0) return null
    const prev = siblings[idx - 1]
    if (isUndefined(prev.children)) return null
    const subtreeDepth = calculateSubtreeDepth(node)
    const prevDepth = calculateParentDepth(cloned, getKey(prev.data))
    if (prevDepth + 1 + subtreeDepth > maxDepth) return null

    siblings.splice(idx, 1)
    prev.children!.push(node)
    ;(node.data as any)[parentField] = getKey(prev.data)
    recalculateSiblings(siblings)
    recalculateSiblings(prev.children!)
    model.value = cloned
    return cloned
  }

  /**
   * Outdent: move the item up one level — it becomes the next sibling of its current parent.
   * Fails if the item is already at root.
   */
  const outdent = (id: ListEditorKey): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const { node, parent } = findNode(id, cloned.children)
    if (!node || !parent) return null

    const { parent: grandParent } = findNode(getKey(parent.data), cloned.children)
    const grandSiblings = grandParent
      ? (grandParent.children as NestedTreeNode<TItem>[])
      : cloned.children
    const parentIdx = grandSiblings.indexOf(parent)
    if (parentIdx === -1) return null

    const currentSiblings = parent.children as NestedTreeNode<TItem>[]
    const idx = currentSiblings.indexOf(node)
    if (idx === -1) return null
    currentSiblings.splice(idx, 1)
    grandSiblings.splice(parentIdx + 1, 0, node)
    ;(node.data as any)[parentField] = grandParent ? getKey(grandParent.data) : null

    recalculateSiblings(currentSiblings)
    recalculateSiblings(grandSiblings)
    model.value = cloned
    return cloned
  }

  const calculateParentDepth = (tree: NestedTree<TItem>, id: ListEditorKey): number => {
    const walk = (arr: NestedTreeNode<TItem>[], depth: number): number | null => {
      for (const item of arr) {
        if (getKey(item.data) === id) return depth
        if (item.children && item.children.length) {
          const d = walk(item.children, depth + 1)
          if (d !== null) return d
        }
      }
      return null
    }
    return walk(tree.children, 0) ?? 0
  }

  /**
   * Move a node to a specific parent at a specific index. Used by drag/drop.
   * Respects maxDepth — returns null if the move would exceed it.
   */
  const moveTo = (
    id: ListEditorKey,
    targetParentId: ListEditorKey | null,
    targetIndex: number,
  ): NestedTree<TItem> | null => {
    const cloned = cloneDeep(model.value) as NestedTree<TItem>
    const { node, parent } = findNode(id, cloned.children)
    if (!node) return null

    if (targetParentId !== null) {
      const isDescendant = (n: NestedTreeNode<TItem>): boolean => {
        if (!n.children) return false
        for (const c of n.children) {
          if (getKey(c.data) === targetParentId) return true
          if (isDescendant(c)) return true
        }
        return false
      }
      if (getKey(node.data) === targetParentId || isDescendant(node)) return null
    }

    let targetSiblings: NestedTreeNode<TItem>[]
    let newParentNode: NestedTreeNode<TItem> | null = null
    let newParentDepth = 0
    if (targetParentId === null) {
      targetSiblings = cloned.children
      newParentDepth = 0
    } else {
      const { node: targetParent } = findNode(targetParentId, cloned.children)
      if (!targetParent || isUndefined(targetParent.children)) return null
      targetSiblings = targetParent.children
      newParentNode = targetParent
      newParentDepth = calculateParentDepth(cloned, targetParentId) + 1
    }

    const subtreeDepth = calculateSubtreeDepth(node)
    if (newParentDepth + subtreeDepth > maxDepth) return null

    const sourceSiblings = parent ? (parent.children as NestedTreeNode<TItem>[]) : cloned.children
    const sourceIdx = sourceSiblings.indexOf(node)
    if (sourceIdx === -1) return null

    const samelist = sourceSiblings === targetSiblings
    const [removed] = sourceSiblings.splice(sourceIdx, 1)
    let insertAt = targetIndex
    if (samelist && sourceIdx < targetIndex) insertAt = targetIndex - 1
    insertAt = Math.max(0, Math.min(insertAt, targetSiblings.length))
    targetSiblings.splice(insertAt, 0, removed)
    ;(removed.data as any)[parentField] = newParentNode ? getKey(newParentNode.data) : null

    if (!samelist) recalculateSiblings(sourceSiblings)
    recalculateSiblings(targetSiblings)
    model.value = cloned
    return cloned
  }

  return {
    viewItems,
    findNode,
    addItem,
    deleteItem,
    updateItem,
    moveUp,
    moveDown,
    moveTop,
    moveBottom,
    indent,
    outdent,
    moveTo,
    recalculatePositions,
    calculateSubtreeDepth,
  }
}
