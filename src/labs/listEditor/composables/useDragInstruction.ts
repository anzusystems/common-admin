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

export const computeInstruction = (
  args: ComputeInstructionArgs,
): Instruction | null => {
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

  // Pointer X → projected depth. Rounded so each half-indent step crosses the
  // threshold between two columns.
  const pointerRelX = pointer.x - containerLeft - containerPaddingLeft
  const rawDepth = Math.round(pointerRelX / indentPx)

  // Anchor — the visible row that sits immediately above the target gap.
  // Top-half: the previous visible row in the flat list (null if hoveredRow
  // is the very first row). Bottom-half: hoveredRow itself.
  const flatIdx = viewItems.findIndex((v) => v.key === hoveredRow.key)
  const anchor: NestedViewItem<any> | null = inTopHalf
    ? (flatIdx > 0 ? viewItems[flatIdx - 1] : null)
    : findByKey(viewItems, hoveredRow.key)

  let desired: ExecutableInstruction

  if (!anchor) {
    // First row at the top of the tree — only landing is the very top of root.
    desired = {
      type: 'insert',
      refKey: hoveredRow.key,
      refEdge: 'top',
      parentKey: null,
      index: 0,
      depth: 0,
      makeChild: false,
    }
  } else {
    // Anchor must not belong to the source subtree (pointer-events: none
    // already filters at the DOM level, but guard defensively).
    if (anchor.key === sourceKey || isDescendantOf(viewItems, sourceKey, anchor.key)) {
      return null
    }
    const depthCeiling = anchor.depth + 1
    const clampedDepth = Math.max(0, Math.min(rawDepth, depthCeiling))

    if (clampedDepth === anchor.depth + 1) {
      desired = {
        type: 'insert',
        refKey: hoveredRow.key,
        refEdge,
        parentKey: anchor.key,
        index: 0,
        depth: clampedDepth,
        makeChild: true,
      }
    } else if (clampedDepth === anchor.depth) {
      desired = {
        type: 'insert',
        refKey: hoveredRow.key,
        refEdge,
        parentKey: anchor.parentKey,
        index: anchor.siblingIndex + 1,
        depth: clampedDepth,
        makeChild: false,
      }
    } else {
      // clampedDepth < anchor.depth → reparent: insert as sibling of the
      // ancestor at `clampedDepth`, immediately after that ancestor.
      const ancestor = findAncestorAtDepth(viewItems, anchor.key, clampedDepth)
      if (ancestor) {
        desired = {
          type: 'insert',
          refKey: hoveredRow.key,
          refEdge,
          parentKey: ancestor.parentKey,
          index: ancestor.siblingIndex + 1,
          depth: clampedDepth,
          makeChild: false,
        }
      } else {
        // Shouldn't hit with clampedDepth ≥ 0 but keep a safe fallback.
        desired = {
          type: 'insert',
          refKey: hoveredRow.key,
          refEdge,
          parentKey: anchor.parentKey,
          index: anchor.siblingIndex + 1,
          depth: anchor.depth,
          makeChild: false,
        }
      }
    }
  }

  if (desired.depth + sourceSubtreeDepth - 1 >= maxDepth) {
    return { type: 'blocked', desired, reason: 'maxDepth' }
  }

  return desired
}
