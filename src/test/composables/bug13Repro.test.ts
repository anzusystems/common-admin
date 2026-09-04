import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useNestedListEditorController } from '@/labs/listEditor/composables/useNestedListEditorController'
import {
  computeInstruction,
  type HoveredRow,
} from '@/labs/listEditor/composables/useDragInstruction'
import type {
  NestedTree,
  NestedTreeNode,
  ListEditorKey,
} from '@/labs/listEditor/types/listEditorTypes'

/**
 * BUG-13 exhaustive replication harness.
 *
 * QA: "when a nested row is the FIRST or LAST item within its parent, dragging
 * it OUT of that nested group can cause it to land in the WRONG position."
 *
 * Strategy: for a set of trees, take EVERY node as the drag source, then
 * enumerate EVERY possible drop gesture (each other row as the hovered row ×
 * top/bottom half × every depth column the pointer could express). For each
 * gesture we (a) compute the drop instruction the editor would show, then (b)
 * apply it through the real `controller.moveTo`, then (c) assert the dragged
 * node actually LANDED where the instruction said it would. Any divergence
 * between "what the drop line promised" and "where it landed" reproduces the
 * bug.
 */

interface Row {
  id: string
  title: string
  position: number
  parent: string | null
}

const ROW_H = 32
const INDENT = 24

const node = (data: Row, children: NestedTreeNode<Row>[] = []): NestedTreeNode<Row> => ({
  data,
  children,
  meta: { dirty: false },
})

const r = (id: string, parent: string | null): Row => ({ id, title: id, position: 0, parent })

// --- fixtures (depth ≤ 2; maxDepth 3 so depth-2 rows have room) ----------------
const trees: Record<string, () => NestedTree<Row>> = {
  // The exact QA-video shape: ED0 owns the single child ED1; ED2..4 at root.
  video: () => ({
    children: [
      node(r('ED0', null), [node(r('ED1', 'ED0'))]),
      node(r('ED2', null)),
      node(r('ED3', null)),
      node(r('ED4', null)),
    ],
    meta: { dirty: false },
  }),
  // Two children so we exercise first-child AND last-child extraction.
  twoChildren: () => ({
    children: [
      node(r('A', null), [node(r('B', 'A')), node(r('C', 'A'))]),
      node(r('D', null)),
      node(r('E', null)),
    ],
    meta: { dirty: false },
  }),
  // Depth-2 chain A>B>C plus siblings, to exercise deep first/last extraction.
  deep: () => ({
    children: [
      node(r('A', null), [node(r('B', 'A'), [node(r('C', 'B'))]), node(r('B2', 'A'))]),
      node(r('D', null)),
    ],
    meta: { dirty: false },
  }),
}

const setup = (tree: NestedTree<Row>) => {
  const store = ref<NestedTree<Row>>(JSON.parse(JSON.stringify(tree)) as NestedTree<Row>)
  const h = useNestedListEditorController<Row>({
    get: () => store.value,
    set: (v) => (store.value = v),
    getKey: 'id',
    maxDepth: 3,
  })
  return { store, h }
}

// Resolve the live parentKey + ordered sibling keys of a node in a tree.
const locate = (
  tree: NestedTree<Row>,
  key: ListEditorKey,
): { parentKey: ListEditorKey | null; siblingKeys: ListEditorKey[]; index: number } | null => {
  let found: {
    parentKey: ListEditorKey | null
    siblingKeys: ListEditorKey[]
    index: number
  } | null = null
  const walk = (nodes: NestedTreeNode<Row>[], parentKey: ListEditorKey | null) => {
    const siblingKeys = nodes.map((n) => n.data.id)
    nodes.forEach((n, i) => {
      if (n.data.id === key) found = { parentKey, siblingKeys, index: i }
      if (n.children?.length) walk(n.children, n.data.id)
    })
  }
  walk(tree.children, null)
  return found
}

describe('BUG-13: drop instruction ↔ landing consistency (exhaustive)', () => {
  // Property test: for every tree × source × hovered row × half × depth column,
  // the dragged node must LAND exactly where the computed drop line promised.
  // A single failing combination (collected into `mismatches`) reproduces the
  // "lands in the wrong position" bug. Run as one test so the suite stays tidy.
  it('every drag gesture lands where the drop line promised (all trees/sources/gaps)', () => {
    const mismatches: string[] = []
    let checked = 0

    for (const [treeName, makeTree] of Object.entries(trees)) {
      const flatKeys = setup(makeTree()).h.viewItems.value.map((v) => v.key)

      for (const source of flatKeys) {
        for (const hovered of flatKeys) {
          if (hovered === source) continue
          for (const half of ['top', 'bottom'] as const) {
            for (let depthCol = 0; depthCol <= 3; depthCol++) {
              const { store, h } = setup(makeTree())
              const viewItems = h.viewItems.value
              const flat = viewItems.map((v) => v.key)
              const hi = flat.indexOf(hovered)
              const hv = viewItems[hi]
              const rectTop = hi * ROW_H
              const hoveredRow: HoveredRow = {
                key: hv.key,
                rect: {
                  top: rectTop,
                  bottom: rectTop + ROW_H,
                  height: ROW_H,
                  left: 0,
                  right: 300,
                  width: 300,
                  x: 0,
                  y: rectTop,
                  toJSON: () => ({}),
                } as DOMRect,
                depth: hv.depth,
                parentKey: hv.parentKey,
                siblingIndex: hv.siblingIndex,
                siblingCount: hv.siblingCount,
              }
              const srcNode = h.findNode(source).node
              const subtreeDepth = srcNode ? h.calculateSubtreeDepth(srcNode) : 1
              const y = half === 'top' ? rectTop + 4 : rectTop + ROW_H - 4
              const inst = computeInstruction({
                pointer: { x: depthCol * INDENT, y },
                hoveredRow,
                sourceKey: source,
                sourceSubtreeDepth: subtreeDepth,
                viewItems,
                maxDepth: 3,
                indentPx: INDENT,
                containerLeft: 0,
                containerPaddingLeft: 0,
              })

              if (inst === null) continue // hovering source/descendant — non-drop
              if (inst.type === 'blocked') continue // refused (maxDepth) — no landing

              const tag = `${treeName}: ${source}->${hovered} ${half}@d${depthCol}`
              const ok = h.moveTo(source, inst.parentKey, inst.index)
              if (!ok) {
                mismatches.push(`${tag}: moveTo refused a non-blocked insert`)
                continue
              }
              checked++

              const loc = locate(store.value, source)!
              if (loc.parentKey !== inst.parentKey) {
                mismatches.push(
                  `${tag}: landed under ${String(loc.parentKey)}, line promised ${String(inst.parentKey)}`,
                )
                continue
              }
              if (inst.makeChild) {
                if (loc.index !== 0)
                  mismatches.push(`${tag}: make-child not first child (idx ${loc.index})`)
              } else if (inst.levelRowKey !== null) {
                const predecessor = loc.index > 0 ? loc.siblingKeys[loc.index - 1] : null
                if (predecessor !== inst.levelRowKey) {
                  mismatches.push(
                    `${tag}: landed after ${String(predecessor)}, line promised after ${String(inst.levelRowKey)}`,
                  )
                }
              } else if (loc.parentKey !== null || loc.index !== 0) {
                mismatches.push(`${tag}: root-top fallback not at root index 0`)
              }
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(200) // sanity: the enumeration actually ran
    expect(mismatches, `\n${mismatches.join('\n')}`).toEqual([])
  })
})
