import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'
import type { NestedViewItem } from '@/labs/listEditor/composables/useNestedListEditor'

/**
 * Drop instruction computed from pointer position during drag. Mirrors
 * Atlassian Pragmatic DnD's tree-item hitbox pattern: row is split into Y
 * bands (top 25% / mid 50% / bottom 25%) for sibling-above / make-child /
 * sibling-below. In the bottom band of a last-in-group row, pointer X left of
 * the row's own indent triggers `reparent` — insert as sibling of an ancestor
 * at the depth picked by pointer X. When the mutation would exceed maxDepth
 * or form a cycle, the instruction is wrapped in `blocked` so the UI can
 * still render the intended target in a warning colour.
 */
export type ExecutableInstruction =
  | {
      type: 'sibling-above'
      refKey: ListEditorKey
      parentKey: ListEditorKey | null
      index: number
      depth: number
    }
  | {
      type: 'sibling-below'
      refKey: ListEditorKey
      parentKey: ListEditorKey | null
      index: number
      depth: number
    }
  | {
      type: 'make-child'
      refKey: ListEditorKey
      parentKey: ListEditorKey
      index: number
      depth: number
    }

export type Instruction =
  | ExecutableInstruction
  | {
      type: 'blocked'
      desired: ExecutableInstruction
      reason: 'maxDepth' | 'cycle'
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
  // Cycle case — the caller disables dragged-subtree rows from hit-testing,
  // but defend against browser quirks that might still route the pointer here.
  if (isDescendantOf(viewItems, sourceKey, hoveredRow.key)) return null

  const y = pointer.y - hoveredRow.rect.top
  const h = hoveredRow.rect.height
  const topBandEnd = h * 0.25
  const bottomBandStart = h * 0.75
  const isLastInGroup = hoveredRow.siblingIndex === hoveredRow.siblingCount - 1

  let desired: ExecutableInstruction

  if (y <= topBandEnd) {
    desired = {
      type: 'sibling-above',
      refKey: hoveredRow.key,
      parentKey: hoveredRow.parentKey,
      index: hoveredRow.siblingIndex,
      depth: hoveredRow.depth,
    }
  } else if (y >= bottomBandStart) {
    const rowIndentPx = containerPaddingLeft + hoveredRow.depth * indentPx
    const pointerRelX = pointer.x - containerLeft
    if (isLastInGroup && pointerRelX < rowIndentPx) {
      const rawDepth = Math.floor(
        (pointerRelX - containerPaddingLeft) / indentPx,
      )
      const clampedDepth = Math.max(0, Math.min(rawDepth, hoveredRow.depth))
      const ancestor = findAncestorAtDepth(viewItems, hoveredRow.key, clampedDepth)
      if (ancestor) {
        desired = {
          type: 'sibling-below',
          refKey: hoveredRow.key,
          parentKey: ancestor.parentKey,
          index: ancestor.siblingIndex + 1,
          depth: clampedDepth,
        }
      } else {
        desired = {
          type: 'sibling-below',
          refKey: hoveredRow.key,
          parentKey: hoveredRow.parentKey,
          index: hoveredRow.siblingIndex + 1,
          depth: hoveredRow.depth,
        }
      }
    } else {
      desired = {
        type: 'sibling-below',
        refKey: hoveredRow.key,
        parentKey: hoveredRow.parentKey,
        index: hoveredRow.siblingIndex + 1,
        depth: hoveredRow.depth,
      }
    }
  } else {
    desired = {
      type: 'make-child',
      refKey: hoveredRow.key,
      parentKey: hoveredRow.key,
      index: 0,
      depth: hoveredRow.depth + 1,
    }
  }

  if (desired.depth + sourceSubtreeDepth - 1 >= maxDepth) {
    return { type: 'blocked', desired, reason: 'maxDepth' }
  }

  return desired
}
