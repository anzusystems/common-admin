import { describe, it, expect } from 'vitest'
import {
  computeInstruction,
  type ComputeInstructionArgs,
  type HoveredRow,
  type Instruction,
  type ExecutableInstruction,
} from '@/labs/listEditor/composables/useDragInstruction'
import type { NestedViewItem } from '@/labs/listEditor/composables/useNestedListEditor'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

// ---------- test-local fixtures ----------
// computeInstruction is DOM-free and only reads the handful of fields
// declared on NestedViewItem that matter for drop computation (key, depth,
// parentKey, siblingIndex). The remaining NestedViewItem fields are padded
// with harmless defaults so the cast to NestedViewItem<unknown> compiles.

interface FakeRowSpec {
  key: ListEditorKey
  depth: number
  parentKey: ListEditorKey | null
  siblingIndex: number
  siblingCount?: number
}

const makeViewItem = (spec: FakeRowSpec, index: number): NestedViewItem<unknown> => {
  const base = {
    key: spec.key,
    index,
    raw: { id: spec.key },
    position: index + 1,
    node: { data: { id: spec.key }, children: [], meta: { dirty: false } },
    depth: spec.depth,
    parent: null,
    parentKey: spec.parentKey,
    childrenCount: 0,
    hasChildren: false,
    childrenAllowed: true,
    siblingIndex: spec.siblingIndex,
    siblingCount: spec.siblingCount ?? 1,
    firstInParent: spec.siblingIndex === 0,
    lastInParent: spec.siblingIndex === (spec.siblingCount ?? 1) - 1,
    canAddChild: true,
    canIndent: false,
    canOutdent: false,
  }
  return base as unknown as NestedViewItem<unknown>
}

const makeViewItems = (specs: FakeRowSpec[]): NestedViewItem<unknown>[] =>
  specs.map((s, i) => makeViewItem(s, i))

const makeRect = (top: number, height: number, left = 0, width = 300): DOMRect => {
  // jsdom / browser may or may not provide DOMRect; hand-roll a plain literal
  // and cast — computeInstruction only reads top + height.
  const rect = {
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
  return rect as DOMRect
}

const makeHoveredRow = (vi: NestedViewItem<unknown>, top: number, height = 32): HoveredRow => ({
  key: vi.key,
  rect: makeRect(top, height),
  depth: vi.depth,
  parentKey: vi.parentKey,
  siblingIndex: vi.siblingIndex,
  siblingCount: vi.siblingCount,
})

const defaultArgs = (over: Partial<ComputeInstructionArgs>): ComputeInstructionArgs => ({
  pointer: { x: 0, y: 0 },
  hoveredRow: over.hoveredRow as HoveredRow,
  sourceKey: over.sourceKey ?? '__no_source__',
  sourceSubtreeDepth: over.sourceSubtreeDepth ?? 1,
  viewItems: over.viewItems ?? [],
  maxDepth: over.maxDepth ?? 10,
  indentPx: over.indentPx ?? 24,
  containerLeft: over.containerLeft ?? 0,
  containerPaddingLeft: over.containerPaddingLeft ?? 0,
  ...over,
})

const asInsert = (r: Instruction | null): ExecutableInstruction => {
  expect(r).not.toBeNull()
  expect(r?.type).toBe('insert')
  return r as ExecutableInstruction
}

// ---------- tests ----------

describe('computeInstruction', () => {
  describe('null guards', () => {
    it('returns null when hovering the source row itself', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[0], 0)

      const result = computeInstruction(
        defaultArgs({
          pointer: { x: 0, y: 5 },
          hoveredRow,
          sourceKey: 'a',
          viewItems,
        }),
      )

      expect(result).toBeNull()
    })

    it('returns null when hovering a descendant of source (cycle prevention)', () => {
      const viewItems = makeViewItems([
        { key: 'root', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 1 },
        { key: 'child', depth: 1, parentKey: 'root', siblingIndex: 0, siblingCount: 1 },
        { key: 'grandchild', depth: 2, parentKey: 'child', siblingIndex: 0, siblingCount: 1 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[2], 64)

      const result = computeInstruction(
        defaultArgs({
          pointer: { x: 0, y: 70 },
          hoveredRow,
          sourceKey: 'root',
          viewItems,
        }),
      )

      expect(result).toBeNull()
    })
  })

  describe('instruction types', () => {
    it('first row top-half → root-top fallback (root, index 0, depth 0, no levelRowKey)', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[0], 0)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            // y deep into top half → inTopHalf true; x irrelevant since prev is missing
            pointer: { x: 100, y: 4 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      expect(result).toEqual({
        type: 'insert',
        refKey: 'a',
        refEdge: 'top',
        parentKey: null,
        index: 0,
        depth: 0,
        makeChild: false,
        levelRowKey: null,
      })
    })

    it('bottom-half + X past hovered row depth → make-child of hovered row', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[0], 0)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            // bottom half (y ≥ h/2), x at one indent → depth 1
            pointer: { x: 24, y: 24 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      expect(result).toEqual({
        type: 'insert',
        refKey: 'a',
        refEdge: 'bottom',
        parentKey: 'a',
        index: 0,
        depth: 1,
        makeChild: true,
        levelRowKey: null,
      })
    })

    it('same-depth sibling insert sets parentKey/index/levelRowKey from prev', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 3 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 3 },
        { key: 'c', depth: 0, parentKey: null, siblingIndex: 2, siblingCount: 3 },
      ])
      // Hover b, top-half → prev = a, next = b → clamp [0, 1]; x=0 → depth 0
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 0, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      expect(result).toEqual({
        type: 'insert',
        refKey: 'b',
        refEdge: 'top',
        parentKey: null,
        index: 1, // a.siblingIndex + 1
        depth: 0,
        makeChild: false,
        levelRowKey: 'a',
      })
    })

    it('reparent to ancestor walks findAncestorAtDepth and uses its key as levelRowKey', () => {
      const viewItems = makeViewItems([
        { key: 'A', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'B', depth: 1, parentKey: 'A', siblingIndex: 0, siblingCount: 1 },
        { key: 'C', depth: 2, parentKey: 'B', siblingIndex: 0, siblingCount: 1 },
        { key: 'D', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      // Hover D top-half → prev = C (depth 2), next = D (depth 0) → clamp [0, 3]
      // pointer.x at one indent → depth 1 → strictly less than prev.depth →
      // walks ancestors of C until depth 1 = B.
      const hoveredRow = makeHoveredRow(viewItems[3], 96)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 24, y: 100 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      expect(result).toEqual({
        type: 'insert',
        refKey: 'D',
        refEdge: 'top',
        parentKey: 'A', // B.parentKey
        index: 1, // B.siblingIndex + 1
        depth: 1,
        makeChild: false,
        levelRowKey: 'B',
      })
    })
  })

  describe('clamp bounds', () => {
    it('prev and next at same depth → clamp [sharedDepth, sharedDepth + 1] regardless of pointer X', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 3 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 3 },
        { key: 'c', depth: 0, parentKey: null, siblingIndex: 2, siblingCount: 3 },
      ])
      // Hover b top-half → prev = a (depth 0), next = b (depth 0).
      // Clamp window is [0, 1]. Extreme-right pointer should not go past 1.
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 10_000, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      // Since clamp ceiling = prev.depth + 1 = 1, the huge X pins depth to 1
      // which triggers make-child of prev.
      expect(result.depth).toBe(1)
      expect(result.makeChild).toBe(true)
      expect(result.parentKey).toBe('a')

      // And extreme-left pointer should not go below 0 (next.depth).
      const leftResult = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: -10_000, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )
      expect(leftResult.depth).toBe(0)
      expect(leftResult.makeChild).toBe(false)
      expect(leftResult.parentKey).toBe(null)
    })

    it('depth transition gap (prev deeper than next) clamps to [next.depth, prev.depth + 1]', () => {
      const viewItems = makeViewItems([
        { key: 'A', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'B', depth: 1, parentKey: 'A', siblingIndex: 0, siblingCount: 1 },
        { key: 'C', depth: 2, parentKey: 'B', siblingIndex: 0, siblingCount: 1 },
        { key: 'D', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      // Hover D top-half → prev = C (depth 2), next = D (depth 0).
      // Clamp [0, 3]. Pointer X pulls below prev.depth → reparent branch.

      const hoveredRow = makeHoveredRow(viewItems[3], 96)

      // ceiling behaviour: x at 3 indents → depth = 3 = prev.depth + 1 → make-child of C
      const makeChildResult = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 24 * 3, y: 100 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )
      expect(makeChildResult.depth).toBe(3)
      expect(makeChildResult.makeChild).toBe(true)
      expect(makeChildResult.parentKey).toBe('C')

      // floor behaviour: x extremely negative → depth pinned to next.depth = 0.
      // depth 0 < prev.depth (2) → reparent branch, ancestor of C at depth 0 = A.
      const floorResult = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: -1_000, y: 100 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )
      expect(floorResult.depth).toBe(0)
      expect(floorResult.makeChild).toBe(false)
      expect(floorResult.parentKey).toBe(null)
      expect(floorResult.levelRowKey).toBe('A')
    })
  })

  describe('refEdge', () => {
    it('refEdge "top" in top-half of row (and prev exists)', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            // y = 34 of 32-top, 32-high row → local y = 2 < 16 → top half
            pointer: { x: 0, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      expect(result.refEdge).toBe('top')
    })

    it('refEdge "bottom" in bottom-half of row', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            // y = 62 → local y = 30 ≥ 16 → bottom half
            pointer: { x: 0, y: 62 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
          }),
        ),
      )

      expect(result.refEdge).toBe('bottom')
    })
  })

  describe('pointerRelX rounding', () => {
    it('11px right of depth-0 column rounds to depth 0', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      // Hover b top-half → prev a, next b, clamp [0, 1]. 11/24 ≈ 0.458 → 0.
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 11, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
            indentPx: 24,
            containerLeft: 0,
            containerPaddingLeft: 0,
          }),
        ),
      )

      expect(result.depth).toBe(0)
      expect(result.makeChild).toBe(false)
      expect(result.levelRowKey).toBe('a')
    })

    it('13px right of depth-0 column flips to depth 1', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      // Hover b top-half → prev a, next b, clamp [0, 1]. 13/24 ≈ 0.541 → 1.
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 13, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
            indentPx: 24,
            containerLeft: 0,
            containerPaddingLeft: 0,
          }),
        ),
      )

      expect(result.depth).toBe(1)
      expect(result.makeChild).toBe(true)
      expect(result.parentKey).toBe('a')
    })

    it('containerLeft and containerPaddingLeft are subtracted from pointer.x', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[1], 32)

      // With containerLeft=100 and containerPaddingLeft=20, a pointer at x=133
      // is 13px into the depth columns → depth 1 (as in the previous case).
      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 133, y: 34 },
            hoveredRow,
            sourceKey: 'dragged',
            viewItems,
            indentPx: 24,
            containerLeft: 100,
            containerPaddingLeft: 20,
          }),
        ),
      )

      expect(result.depth).toBe(1)
      expect(result.makeChild).toBe(true)
    })
  })

  describe('subtree exclusion', () => {
    it('rows inside source subtree are skipped when finding prev/next for clamp', () => {
      // Layout: A, S (source), S-child, B. Hover B top-half.
      // Without skipping: prev would be S-child (depth 1) → ceiling 2.
      // With skipping: prev walks past S-child and S, landing on A (depth 0) → ceiling 1.
      const viewItems = makeViewItems([
        { key: 'A', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 3 },
        { key: 'S', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 3 },
        { key: 'Sc', depth: 1, parentKey: 'S', siblingIndex: 0, siblingCount: 1 },
        { key: 'B', depth: 0, parentKey: null, siblingIndex: 2, siblingCount: 3 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[3], 96)

      // Extreme-right X would otherwise land at depth 2 if prev were S-child.
      // After exclusion prev=A (depth 0), next=B (depth 0) → clamp [0, 1] → make-child of A.
      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 10_000, y: 100 },
            hoveredRow,
            sourceKey: 'S',
            viewItems,
          }),
        ),
      )

      expect(result.depth).toBe(1)
      expect(result.makeChild).toBe(true)
      expect(result.parentKey).toBe('A')
      expect(result.levelRowKey).toBe(null)
    })
  })

  describe('BUG-13: nested child dragged out to root lands beside its parent, not at index 0', () => {
    // QA video tree: ED0 (single child ED1), then ED2, ED3, ED4 at root.
    // Source = ED1. Dropping it at root depth just below ED0 must resolve to
    // root index 1 (AFTER ED0) — whether the pointer expresses that via ED0's
    // bottom-half or via ED2's top-half. (Index 0 / above ED0 is only correct
    // when the pointer explicitly aims at ED0's TOP half — a distinct gesture.)
    const viewItems = makeViewItems([
      { key: 'ED0', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 4 },
      { key: 'ED1', depth: 1, parentKey: 'ED0', siblingIndex: 0, siblingCount: 1 },
      { key: 'ED2', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 4 },
      { key: 'ED3', depth: 0, parentKey: null, siblingIndex: 2, siblingCount: 4 },
      { key: 'ED4', depth: 0, parentKey: null, siblingIndex: 3, siblingCount: 4 },
    ])

    it("hovering the parent's bottom-half at root depth → root index 1 (after the parent)", () => {
      const hoveredRow = makeHoveredRow(viewItems[0], 0) // ED0 at top, height 32
      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 0, y: 24 }, // bottom half of ED0, depth 0 (far left)
            hoveredRow,
            sourceKey: 'ED1',
            viewItems,
          }),
        ),
      )
      expect(result.parentKey).toBe(null)
      expect(result.index).toBe(1) // after ED0 — NOT 0 (above ED0)
      expect(result.depth).toBe(0)
      expect(result.levelRowKey).toBe('ED0')
    })

    it("hovering the following root row's top-half at root depth → also root index 1", () => {
      const hoveredRow = makeHoveredRow(viewItems[2], 64) // ED2
      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 0, y: 66 }, // top half of ED2, depth 0
            hoveredRow,
            sourceKey: 'ED1',
            viewItems,
          }),
        ),
      )
      expect(result.parentKey).toBe(null)
      expect(result.index).toBe(1)
    })

    it("the root-top fallback (index 0) only fires when aiming at the parent's TOP half", () => {
      const hoveredRow = makeHoveredRow(viewItems[0], 0)
      const result = asInsert(
        computeInstruction(
          defaultArgs({
            pointer: { x: 0, y: 4 }, // top half of ED0 → above the parent
            hoveredRow,
            sourceKey: 'ED1',
            viewItems,
          }),
        ),
      )
      expect(result.parentKey).toBe(null)
      expect(result.index).toBe(0) // explicitly above ED0 — the distinct gesture
    })
  })

  describe('blocked (maxDepth)', () => {
    it('wraps desired in blocked when desired.depth + sourceSubtreeDepth - 1 >= maxDepth', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      // Hover a bottom-half, X one indent → make-child at depth 1.
      // Desired depth 1 + sourceSubtreeDepth 2 - 1 = 2; with maxDepth = 2, 2 >= 2 → blocked.
      const hoveredRow = makeHoveredRow(viewItems[0], 0)

      const result = computeInstruction(
        defaultArgs({
          pointer: { x: 24, y: 24 },
          hoveredRow,
          sourceKey: 'dragged',
          sourceSubtreeDepth: 2,
          viewItems,
          maxDepth: 2,
        }),
      )

      expect(result).not.toBeNull()
      expect(result?.type).toBe('blocked')
      if (result && result.type === 'blocked') {
        expect(result.reason).toBe('maxDepth')
        // desired payload still filled in
        expect(result.desired).toEqual({
          type: 'insert',
          refKey: 'a',
          refEdge: 'bottom',
          parentKey: 'a',
          index: 0,
          depth: 1,
          makeChild: true,
          levelRowKey: null,
        })
      }
    })

    it('returns a plain insert (not blocked) when maxDepth allows the move', () => {
      const viewItems = makeViewItems([
        { key: 'a', depth: 0, parentKey: null, siblingIndex: 0, siblingCount: 2 },
        { key: 'b', depth: 0, parentKey: null, siblingIndex: 1, siblingCount: 2 },
      ])
      const hoveredRow = makeHoveredRow(viewItems[0], 0)

      const result = computeInstruction(
        defaultArgs({
          pointer: { x: 24, y: 24 },
          hoveredRow,
          sourceKey: 'dragged',
          sourceSubtreeDepth: 1,
          viewItems,
          maxDepth: 10,
        }),
      )

      expect(result?.type).toBe('insert')
    })
  })
})
