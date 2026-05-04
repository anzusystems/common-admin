import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'
import type { NestedViewItem } from '@/labs/listEditor/composables/useNestedListEditor'

/**
 * Drop instruction — where the dragged item will land + how to paint the line.
 *
 * Outliner model (dnd-kit / Workflowy style):
 *   - Pointer Y picks which gap the drop lands in: the upper 50% of the
 *     hovered row = the gap above it, the lower 50% = the gap below.
 *   - Pointer X picks the depth within that gap. Depth is measured in indent
 *     columns of `indentPx` each, rounded to the nearest column, and clamped
 *     to `[0, anchor.depth + 1]` where `anchor` is the visible row immediately
 *     above the target gap. You can never skip more than one level deeper
 *     than what's already on the row above — same rule as dnd-kit's
 *     SortableTree — which keeps the tree structure coherent.
 *
 * `makeChild: true` when the chosen depth is one level deeper than the
 * anchor. The target becomes a new parent and the consumer should
 * auto-expand `parentKey` so the inserted row stays visible.
 *
 * `blocked` wraps the would-be instruction when the move would breach
 * `maxDepth` — the overlay keeps rendering the line in a warning colour
 * so the intent stays legible but the mutation is refused.
 */

export type ExecutableInstruction = {
  type: 'insert'
  refKey: ListEditorKey
  refEdge: 'top' | 'bottom'
  parentKey: ListEditorKey | null
  index: number
  depth: number
  makeChild: boolean
  // Row whose level the inserted item will match — the sibling we're
  // inserting after (sibling case) or the ancestor we're joining as sibling
  // of (reparent case). `null` for make-child (creating a brand new deeper
  // level, no existing peer to anchor against) and the root-top fallback.
  // Consumers render a thin connector from the drop line up to this row so
  // the user can see which row dictates the new level.
  levelRowKey: ListEditorKey | null
}

export type Instruction =
  | ExecutableInstruction
  | {
      type: 'blocked'
      desired: ExecutableInstruction
      reason: 'maxDepth'
    }

export interface HoveredRow {
  key: ListEditorKey
  rect: DOMRect
  depth: number
  parentKey: ListEditorKey | null
  siblingIndex: number
  siblingCount: number
}

export interface ComputeInstructionArgs {
  pointer: { x: number; y: number }
  hoveredRow: HoveredRow
  sourceKey: ListEditorKey
  sourceSubtreeDepth: number
  viewItems: NestedViewItem<any>[]
  maxDepth: number
  indentPx: number
  containerLeft: number
  containerPaddingLeft: number
}

const findByKey = (
  viewItems: NestedViewItem<any>[],
  key: ListEditorKey,
): NestedViewItem<any> | null => viewItems.find((v) => v.key === key) ?? null

const isDescendantOf = (
  viewItems: NestedViewItem<any>[],
  ancestorKey: ListEditorKey,
  candidateKey: ListEditorKey,
): boolean => {
  let current = findByKey(viewItems, candidateKey)
  while (current && current.parentKey !== null) {
    if (current.parentKey === ancestorKey) return true
    current = findByKey(viewItems, current.parentKey)
  }
  return false
}

const findAncestorAtDepth = (
  viewItems: NestedViewItem<any>[],
  startKey: ListEditorKey,
  targetDepth: number,
): NestedViewItem<any> | null => {
  let current = findByKey(viewItems, startKey)
  while (current && current.depth > targetDepth) {
    if (current.parentKey === null) return null
    current = findByKey(viewItems, current.parentKey)
  }
  return current && current.depth === targetDepth ? current : null
}

const isInSourceSubtree = (
  viewItems: NestedViewItem<any>[],
  sourceKey: ListEditorKey,
  candidateKey: ListEditorKey,
): boolean => candidateKey === sourceKey || isDescendantOf(viewItems, sourceKey, candidateKey)

// Walk the flat view-items list in `dir` (±1) starting at `startIdx`, skipping
// any row that belongs to the dragged subtree — those rows aren't visible drop
// targets so they shouldn't define the gap boundaries for depth clamping.
const findSiblingNotInSource = (
  viewItems: NestedViewItem<any>[],
  startIdx: number,
  dir: 1 | -1,
  sourceKey: ListEditorKey,
): NestedViewItem<any> | null => {
  for (let i = startIdx; i >= 0 && i < viewItems.length; i += dir) {
    const vi = viewItems[i]
    if (!isInSourceSubtree(viewItems, sourceKey, vi.key)) return vi
  }
  return null
}

export const computeInstruction = (args: ComputeInstructionArgs): Instruction | null => {
  const {
    pointer,
    hoveredRow,
    sourceKey,
    sourceSubtreeDepth,
    viewItems,
    maxDepth,
    indentPx,
    containerLeft,
    containerPaddingLeft,
  } = args

  if (hoveredRow.key === sourceKey) return null
  if (isDescendantOf(viewItems, sourceKey, hoveredRow.key)) return null

  const y = pointer.y - hoveredRow.rect.top
  const h = hoveredRow.rect.height
  const inTopHalf = y < h / 2
  const refEdge: 'top' | 'bottom' = inTopHalf ? 'top' : 'bottom'

  // The gap between two flat-adjacent rows frames the drop. `prev` is the
  // row immediately above the gap, `next` is the row immediately below it.
  // Rows belonging to the dragged subtree don't exist for clamping purposes —
  // they'll disappear from the flat list once the move completes, so they
  // can't define the depth bounds of the drop.
  const flatIdx = viewItems.findIndex((v) => v.key === hoveredRow.key)
  const prev: NestedViewItem<any> | null = inTopHalf
    ? findSiblingNotInSource(viewItems, flatIdx - 1, -1, sourceKey)
    : findSiblingNotInSource(viewItems, flatIdx, -1, sourceKey)
  const next: NestedViewItem<any> | null = inTopHalf
    ? findSiblingNotInSource(viewItems, flatIdx, 1, sourceKey)
    : findSiblingNotInSource(viewItems, flatIdx + 1, 1, sourceKey)

  // Depth bounds for this gap:
  //   maxDepth = prev.depth + 1 (you can nest one level deeper than prev).
  //   minDepth = next.depth     (shallower would insert AFTER next's parent
  //                              subtree, i.e., at a different Y than the
  //                              user is pointing at — so that's not a valid
  //                              option for THIS gap).
  // If prev is missing (gap at top of tree) or next is missing (bottom of
  // tree), the missing side defaults to 0.
  const pointerRelX = pointer.x - containerLeft - containerPaddingLeft
  const rawDepth = Math.round(pointerRelX / indentPx)
  const depthCeiling = prev ? prev.depth + 1 : 0
  const depthFloor = next ? next.depth : 0
  const clampedDepth = Math.max(depthFloor, Math.min(rawDepth, depthCeiling))

  let desired: ExecutableInstruction

  if (!prev) {
    // Gap at the very top of the tree — only landing is root index 0.
    desired = {
      type: 'insert',
      refKey: hoveredRow.key,
      refEdge: 'top',
      parentKey: null,
      index: 0,
      depth: 0,
      makeChild: false,
      levelRowKey: null,
    }
  } else if (clampedDepth === prev.depth + 1) {
    desired = {
      type: 'insert',
      refKey: hoveredRow.key,
      refEdge,
      parentKey: prev.key,
      index: 0,
      depth: clampedDepth,
      makeChild: true,
      levelRowKey: null,
    }
  } else if (clampedDepth === prev.depth) {
    desired = {
      type: 'insert',
      refKey: hoveredRow.key,
      refEdge,
      parentKey: prev.parentKey,
      index: prev.siblingIndex + 1,
      depth: clampedDepth,
      makeChild: false,
      levelRowKey: prev.key,
    }
  } else {
    // clampedDepth < prev.depth → reparent to ancestor at clampedDepth.
    const ancestor = findAncestorAtDepth(viewItems, prev.key, clampedDepth)
    if (ancestor) {
      desired = {
        type: 'insert',
        refKey: hoveredRow.key,
        refEdge,
        parentKey: ancestor.parentKey,
        index: ancestor.siblingIndex + 1,
        depth: clampedDepth,
        makeChild: false,
        levelRowKey: ancestor.key,
      }
    } else {
      // Shouldn't hit with clampedDepth ≥ 0 but keep a safe fallback.
      desired = {
        type: 'insert',
        refKey: hoveredRow.key,
        refEdge,
        parentKey: prev.parentKey,
        index: prev.siblingIndex + 1,
        depth: prev.depth,
        makeChild: false,
        levelRowKey: prev.key,
      }
    }
  }

  if (desired.depth + sourceSubtreeDepth - 1 >= maxDepth) {
    return { type: 'blocked', desired, reason: 'maxDepth' }
  }

  return desired
}
