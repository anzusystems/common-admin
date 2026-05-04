import { describe, it, expect } from 'vitest'
import { ref, type Ref } from 'vue'
import { useNestedListEditor } from '@/labs/listEditor/composables/useNestedListEditor'
import type {
  ListEditorKey,
  NestedTree,
  NestedTreeNode,
} from '@/labs/listEditor/types/listEditorTypes'

interface MenuItem {
  id: number
  position: number
  parent: number | null
  title: string
}

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

const node = (
  id: number,
  title: string,
  parent: number | null,
  position: number,
  children?: NestedTreeNode<MenuItem>[],
): NestedTreeNode<MenuItem> => ({
  data: { id, title, parent, position },
  children,
  meta: { dirty: false },
})

/**
 * Realistic tree:
 *
 *   Docs (1)
 *     Guides (2)
 *       Vue (3)
 *         Advanced (4)
 *           Composition API (5)
 *           Reactivity (6)
 *   Blog (10)
 *     2026 (11)
 *   Changelog (20)
 */
const makeTree = (): NestedTree<MenuItem> => ({
  meta: { dirty: false },
  children: [
    node(1, 'Docs', null, 1, [
      node(2, 'Guides', 1, 1, [
        node(3, 'Vue', 2, 1, [
          node(4, 'Advanced', 3, 1, [
            node(5, 'Composition API', 4, 1, []),
            node(6, 'Reactivity', 4, 2, []),
          ]),
        ]),
      ]),
    ]),
    node(10, 'Blog', null, 2, [node(11, '2026', 10, 1, [])]),
    node(20, 'Changelog', null, 3, []),
  ],
})

const makeModel = (): Ref<NestedTree<MenuItem>> => ref(makeTree())

const newItem = (id: number, title = `Item ${id}`): MenuItem => ({
  id,
  position: 0,
  parent: null,
  title,
})

/** Collect keys of a flat view-items list for quick order assertions. */
const keys = <T extends { key: ListEditorKey }>(items: T[]): ListEditorKey[] =>
  items.map((i) => i.key)

/** Get sibling order under a given parent (or root if null) in a tree. */
const siblingIds = (tree: NestedTree<MenuItem>, parentId: number | null): number[] => {
  if (parentId === null) return tree.children.map((n) => n.data.id)
  const walk = (arr: NestedTreeNode<MenuItem>[]): NestedTreeNode<MenuItem> | null => {
    for (const n of arr) {
      if (n.data.id === parentId) return n
      if (n.children) {
        const found = walk(n.children)
        if (found) return found
      }
    }
    return null
  }
  const parent = walk(tree.children)
  return (parent?.children ?? []).map((n) => n.data.id)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNestedListEditor', () => {
  // -------------------------------------------------------------------------
  describe('addItem', () => {
    it('appends to root when called without a hint', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99, 'New'))

      expect(siblingIds(model.value, null)).toEqual([1, 10, 20, 99])
    })

    it('inserts after afterId in the correct sibling group — deeply nested', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // afterId=5 lives under Advanced(4); new node should land as sibling of 5,6
      api.addItem(newItem(99), { afterId: 5 })

      expect(siblingIds(model.value, 4)).toEqual([5, 99, 6])
      // Root sibling list is untouched
      expect(siblingIds(model.value, null)).toEqual([1, 10, 20])
    })

    it('inserts after afterId at root level', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99), { afterId: 1 })

      expect(siblingIds(model.value, null)).toEqual([1, 99, 10, 20])
    })

    it('inserts as first child when parentId + asFirstChild=true', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99), { parentId: 4, asFirstChild: true })

      expect(siblingIds(model.value, 4)).toEqual([99, 5, 6])
    })

    it('inserts as last child when only parentId given', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99), { parentId: 4 })

      expect(siblingIds(model.value, 4)).toEqual([5, 6, 99])
    })

    it('respects afterIndex hint within the target parent', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99), { parentId: 4, afterIndex: 0 })

      expect(siblingIds(model.value, 4)).toEqual([5, 99, 6])
    })

    it('respects exact index hint within the target parent', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99), { parentId: 4, index: 0 })

      expect(siblingIds(model.value, 4)).toEqual([99, 5, 6])
    })

    it('recalculates position on affected siblings using positionMultiplier', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, {
        maxDepth: 10,
        positionMultiplier: 10,
      })

      api.addItem(newItem(99), { afterId: 5 })

      const found = api.findNode(4).node!
      const positions = (found.children ?? []).map((n) => [n.data.id, n.data.position])
      expect(positions).toEqual([
        [5, 10],
        [99, 20],
        [6, 30],
      ])
    })

    it('respects childrenAllowed=false (node has children: undefined)', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.addItem(newItem(99), { childrenAllowed: false })

      const created = api.findNode(99).node!
      expect(created.children).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  describe('deleteItem', () => {
    it('removes a leaf', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.deleteItem(20)

      expect(siblingIds(model.value, null)).toEqual([1, 10])
    })

    it('removes a whole subtree when target has children', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.deleteItem(3) // Vue — has Advanced → Composition API, Reactivity

      expect(siblingIds(model.value, 2)).toEqual([])
      expect(api.findNode(3).node).toBeNull()
      expect(api.findNode(4).node).toBeNull()
      expect(api.findNode(5).node).toBeNull()
      expect(api.findNode(6).node).toBeNull()
    })

    it('recalculates position on remaining siblings', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, {
        maxDepth: 10,
        positionMultiplier: 10,
      })

      api.deleteItem(5) // leaves only Reactivity(6) under Advanced(4)

      const advanced = api.findNode(4).node!
      expect(advanced.children!.map((n) => [n.data.id, n.data.position])).toEqual([[6, 10]])
    })

    it('is a no-op when id does not exist', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      const before = JSON.stringify(model.value)

      api.deleteItem(99999)

      expect(JSON.stringify(model.value)).toBe(before)
    })
  })

  // -------------------------------------------------------------------------
  describe('updateItem', () => {
    it('replaces data of a node identified by key', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.updateItem(3, { id: 3, position: 999, parent: 2, title: 'Vue Renamed' })

      const n = api.findNode(3).node!
      expect(n.data.title).toBe('Vue Renamed')
      expect(n.data.position).toBe(999)
    })

    it('preserves children when updating data', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.updateItem(3, { id: 3, position: 1, parent: 2, title: 'Vue Renamed' })

      const n = api.findNode(3).node!
      expect(n.children).toBeDefined()
      expect(n.children!.map((c) => c.data.id)).toEqual([4])
      expect(api.findNode(4).node).not.toBeNull()
      expect(api.findNode(5).node).not.toBeNull()
    })

    it('is a no-op when id does not exist', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      const before = JSON.stringify(model.value)

      api.updateItem(99999, { id: 99999, position: 0, parent: null, title: 'x' })

      expect(JSON.stringify(model.value)).toBe(before)
    })
  })

  // -------------------------------------------------------------------------
  describe('moveUp / moveDown / moveTop / moveBottom', () => {
    it('moveUp swaps within siblings', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveUp(6) // under Advanced

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, 4)).toEqual([6, 5])
    })

    it('moveUp returns null when already first', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      const before = JSON.stringify(model.value)

      const res = api.moveUp(5)

      expect(res).toBeNull()
      expect(JSON.stringify(model.value)).toBe(before)
    })

    it('moveDown swaps within siblings', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveDown(5)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, 4)).toEqual([6, 5])
    })

    it('moveDown returns null when already last', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      const before = JSON.stringify(model.value)

      const res = api.moveDown(6)

      expect(res).toBeNull()
      expect(JSON.stringify(model.value)).toBe(before)
    })

    it('moveTop moves to first position within siblings', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveTop(20) // root, currently last

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, null)).toEqual([20, 1, 10])
    })

    it('moveTop returns null when already first', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveTop(1)

      expect(res).toBeNull()
    })

    it('moveBottom moves to last position within siblings', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveBottom(1)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, null)).toEqual([10, 20, 1])
    })

    it('moveBottom returns null when already last', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveBottom(20)

      expect(res).toBeNull()
    })

    it('works at any depth (moveUp on deeply-nested node)', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.moveUp(6)

      expect(siblingIds(model.value, 4)).toEqual([6, 5])
    })

    it('preserves the subtree of the moved node', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      // Give Changelog(20) a child so we can verify subtree preservation
      api.addItem(newItem(21, 'v1'), { parentId: 20 })

      api.moveTop(20)

      expect(siblingIds(model.value, null)).toEqual([20, 1, 10])
      expect(siblingIds(model.value, 20)).toEqual([21])
    })

    it('recalculates positions on affected siblings', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, {
        maxDepth: 10,
        positionMultiplier: 10,
      })

      api.moveDown(5) // 5 <-> 6 under Advanced

      const advanced = api.findNode(4).node!
      expect(advanced.children!.map((n) => [n.data.id, n.data.position])).toEqual([
        [6, 10],
        [5, 20],
      ])
    })
  })

  // -------------------------------------------------------------------------
  describe('indent', () => {
    it('moves row under its previous sibling as last child', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Add a second child to Guides so Vue(3) has a previous sibling
      api.addItem(newItem(30, 'Tutorials'), { parentId: 1, afterId: 2 })
      // Root layout for Docs: Guides(2), Tutorials(30)
      expect(siblingIds(model.value, 1)).toEqual([2, 30])

      // Indent Tutorials under Guides
      const res = api.indent(30)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, 1)).toEqual([2])
      expect(siblingIds(model.value, 2)).toEqual([3, 30])
    })

    it('sets parent field on the moved node', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      api.addItem(newItem(30, 'Tutorials'), { parentId: 1, afterId: 2 })

      api.indent(30)

      const moved = api.findNode(30).node!
      expect(moved.data.parent).toBe(2)
    })

    it('returns null when no previous sibling', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.indent(1) // Docs is first root item

      expect(res).toBeNull()
    })

    it('returns null when previous sibling has children: undefined', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Add two new root-level siblings; make the first (leaf) without children,
      // then a second sibling after it — that second one's previous sibling
      // doesn't allow children.
      api.addItem(newItem(30, 'Leaf'), { childrenAllowed: false })
      api.addItem(newItem(31, 'Target'), { afterId: 30 })

      const res = api.indent(31)

      expect(res).toBeNull()
    })

    it('returns null when resulting depth would exceed maxDepth', () => {
      const model = makeModel()
      const apiStrict = useNestedListEditor<MenuItem>(model, { maxDepth: 4 })

      const res = apiStrict.indent(6)

      expect(res).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('outdent', () => {
    it('moves row up one level, placing it after its parent in grandparent', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Outdent Reactivity(6) — parent is Advanced(4), grandparent is Vue(3)
      const res = api.outdent(6)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, 4)).toEqual([5])
      expect(siblingIds(model.value, 3)).toEqual([4, 6])
    })

    it('sets parent field correctly (grandparent id)', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.outdent(6)

      expect(api.findNode(6).node!.data.parent).toBe(3)
    })

    it('sets parent field to null when grandparent is root', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Outdent 2026(11) — parent is Blog(10), grandparent is root
      api.outdent(11)

      expect(siblingIds(model.value, null)).toEqual([1, 10, 11, 20])
      expect(api.findNode(11).node!.data.parent).toBeNull()
    })

    it('returns null when already at root', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.outdent(1)

      expect(res).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  describe('moveTo', () => {
    it('cross-parent move: root sibling under another root parent as child', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Move Changelog(20) under Blog(10) at index 0 (before 2026)
      const res = api.moveTo(20, 10, 0)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, null)).toEqual([1, 10])
      expect(siblingIds(model.value, 10)).toEqual([20, 11])
      expect(api.findNode(20).node!.data.parent).toBe(10)
    })

    it('prevents cycle: moving a node under its own descendant returns null', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Try to move Docs(1) under Advanced(4) — Advanced is a descendant of Docs
      const res = api.moveTo(1, 4, 0)

      expect(res).toBeNull()
      // Layout unchanged
      expect(siblingIds(model.value, null)).toEqual([1, 10, 20])
    })

    it('prevents cycle: moving a node onto itself returns null', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const res = api.moveTo(1, 1, 0)

      expect(res).toBeNull()
    })

    it('respects maxDepth: refuses move that would exceed it', () => {
      const model = makeModel()
      // Changelog(20) is a leaf — subtreeDepth=1. Moving it under Advanced(4, depth 3)
      // would put it at depth 4. With maxDepth=4 it should be refused.
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 4 })

      const res = api.moveTo(20, 4, 0)

      expect(res).toBeNull()
    })

    it('allows move when new depth is exactly maxDepth', () => {
      const model = makeModel()
      // Same scenario but with maxDepth=5 (exactly fits).
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 5 })

      const res = api.moveTo(20, 4, 0)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, 4)).toEqual([20, 5, 6])
    })

    it('same-list reorder works and adjusts index when source was before target', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Root is [1, 10, 20]. Move 1 to index 2 — source (0) is before target,
      // so after removal insertion index becomes 1; the resulting order is [10, 1, 20].
      const res = api.moveTo(1, null, 2)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, null)).toEqual([10, 1, 20])
    })

    it('same-list reorder backward (source after target) uses raw index', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Root is [1, 10, 20]. Move 20 (index 2) to index 0.
      const res = api.moveTo(20, null, 0)

      expect(res).not.toBeNull()
      expect(siblingIds(model.value, null)).toEqual([20, 1, 10])
    })

    it('updates parent field on moved node', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.moveTo(20, 10, 0)

      expect(api.findNode(20).node!.data.parent).toBe(10)
    })

    it('moves back to root: parent is null', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.moveTo(11, null, 0) // 2026 from under Blog to root

      expect(api.findNode(11).node!.data.parent).toBeNull()
      expect(siblingIds(model.value, null)).toEqual([11, 1, 10, 20])
    })

    it('recalculates positions on both source and target sibling lists', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, {
        maxDepth: 10,
        positionMultiplier: 10,
      })

      // Move Reactivity(6) under Vue(3) at index 0 (cross-parent).
      api.moveTo(6, 3, 0)

      // Source siblings (under Advanced) now only has 5 → position 10
      const advanced = api.findNode(4).node!
      expect(advanced.children!.map((n) => [n.data.id, n.data.position])).toEqual([[5, 10]])

      // Target siblings (under Vue) now [6, 4] with positions 10, 20
      const vue = api.findNode(3).node!
      expect(vue.children!.map((n) => [n.data.id, n.data.position])).toEqual([
        [6, 10],
        [4, 20],
      ])
    })
  })

  // -------------------------------------------------------------------------
  describe('viewItems', () => {
    it('flat list reflects expansion via expandedKeys — only visible rows', () => {
      const model = makeModel()
      const expandedKeys = ref<Set<ListEditorKey>>(new Set([1, 10])) // only top-two expand
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10, expandedKeys })

      // Visible: 1, 2 (child of 1, 1 is expanded), 10, 11 (child of 10), 20
      // But 2 is only visible if 1 is expanded (yes) — its own children are hidden
      // because 2 is not in expandedKeys.
      expect(keys(api.viewItems.value)).toEqual([1, 2, 10, 11, 20])
    })

    it('DFS preorder when all expanded (no expandedKeys passed)', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      expect(keys(api.viewItems.value)).toEqual([1, 2, 3, 4, 5, 6, 10, 11, 20])
    })

    it('each item has the expected depth/parent/sibling fields', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })
      const items = api.viewItems.value

      // Docs(1): root, first, only 3 root siblings
      const docs = items.find((i) => i.key === 1)!
      expect(docs.depth).toBe(0)
      expect(docs.parentKey).toBeNull()
      expect(docs.siblingIndex).toBe(0)
      expect(docs.siblingCount).toBe(3)
      expect(docs.firstInParent).toBe(true)
      expect(docs.lastInParent).toBe(false)
      expect(docs.hasChildren).toBe(true)
      expect(docs.childrenAllowed).toBe(true)
      expect(docs.canIndent).toBe(false) // first in parent
      expect(docs.canOutdent).toBe(false) // already root
      expect(docs.canAddChild).toBe(true) // maxDepth=10 allows

      // Changelog(20): root, last
      const changelog = items.find((i) => i.key === 20)!
      expect(changelog.siblingIndex).toBe(2)
      expect(changelog.firstInParent).toBe(false)
      expect(changelog.lastInParent).toBe(true)
      expect(changelog.hasChildren).toBe(false)

      // Reactivity(6): under Advanced(4), depth 4
      const reactivity = items.find((i) => i.key === 6)!
      expect(reactivity.depth).toBe(4)
      expect(reactivity.parentKey).toBe(4)
      expect(reactivity.siblingIndex).toBe(1)
      expect(reactivity.siblingCount).toBe(2)
      expect(reactivity.firstInParent).toBe(false)
      expect(reactivity.lastInParent).toBe(true)
      expect(reactivity.canIndent).toBe(true) // has prev sibling Composition API(5)
      expect(reactivity.canOutdent).toBe(true)
    })

    it('canAddChild respects remaining depth budget', () => {
      const model = makeModel()
      // maxDepth=5 means the deepest allowed node lives at depth 4 (0-indexed).
      // Composition API(5) is at depth 4 → remaining depth = 0 → canAddChild=false.
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 5 })
      const items = api.viewItems.value

      const compApi = items.find((i) => i.key === 5)!
      expect(compApi.canAddChild).toBe(false)
    })

    it('uses order matching DFS preorder after a mutation', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      api.moveTop(20)

      expect(keys(api.viewItems.value)).toEqual([20, 1, 2, 3, 4, 5, 6, 10, 11])
    })
  })

  // -------------------------------------------------------------------------
  describe('calculateSubtreeDepth', () => {
    it('returns 1 for a leaf', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      const leaf = api.findNode(5).node!
      expect(api.calculateSubtreeDepth(leaf)).toBe(1)
    })

    it('returns depth equal to chain length for a single-child chain', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Vue(3) → Advanced(4) → [5, 6]. That branch from Vue has depth 3
      // (Vue, Advanced, leaf). But single-child chain: Advanced has two children
      // so not pure chain. Guides(2) → Vue(3) → Advanced(4) → leaf: chain is 4
      // when counting from Guides.
      const guides = api.findNode(2).node!
      expect(api.calculateSubtreeDepth(guides)).toBe(4)
    })

    it('returns deepest branch + 1 for a wide tree', () => {
      const model = makeModel()
      const api = useNestedListEditor<MenuItem>(model, { maxDepth: 10 })

      // Docs(1) has Guides which goes 4 more levels deep → subtree depth of Docs = 5
      const docs = api.findNode(1).node!
      expect(api.calculateSubtreeDepth(docs)).toBe(5)

      // Blog(10) is 10 → 11 (leaf) → subtree depth = 2
      const blog = api.findNode(10).node!
      expect(api.calculateSubtreeDepth(blog)).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  describe('recalculatePositions', () => {
    it('fresh tree gets sequential positions using the multiplier', () => {
      const api = useNestedListEditor<MenuItem>(ref(makeTree()), {
        maxDepth: 10,
        positionMultiplier: 10,
      })

      // Build an unsequenced tree (all positions 0)
      const tree: NestedTree<MenuItem> = {
        meta: { dirty: false },
        children: [
          node(1, 'A', null, 0, [node(11, 'A1', 1, 0, []), node(12, 'A2', 1, 0, [])]),
          node(2, 'B', null, 0, []),
          node(3, 'C', null, 0, []),
        ],
      }

      const out = api.recalculatePositions(tree)

      expect(out.children.map((n) => [n.data.id, n.data.position])).toEqual([
        [1, 10],
        [2, 20],
        [3, 30],
      ])
      expect(out.children[0].children!.map((n) => [n.data.id, n.data.position])).toEqual([
        [11, 10],
        [12, 20],
      ])
    })

    it('uses multiplier 1 by default', () => {
      const api = useNestedListEditor<MenuItem>(ref(makeTree()), { maxDepth: 10 })

      const tree: NestedTree<MenuItem> = {
        meta: { dirty: false },
        children: [node(1, 'A', null, 0, []), node(2, 'B', null, 0, []), node(3, 'C', null, 0, [])],
      }

      const out = api.recalculatePositions(tree)

      expect(out.children.map((n) => n.data.position)).toEqual([1, 2, 3])
    })

    it('does not mutate input (returns cloned tree)', () => {
      const api = useNestedListEditor<MenuItem>(ref(makeTree()), { maxDepth: 10 })

      const tree: NestedTree<MenuItem> = {
        meta: { dirty: false },
        children: [node(1, 'A', null, 0, [node(11, 'A1', 1, 0, [])]), node(2, 'B', null, 0, [])],
      }
      const snapshot = JSON.stringify(tree)

      const out = api.recalculatePositions(tree)

      expect(JSON.stringify(tree)).toBe(snapshot)
      expect(out).not.toBe(tree)
      expect(out.children[0]).not.toBe(tree.children[0])
    })
  })
})
