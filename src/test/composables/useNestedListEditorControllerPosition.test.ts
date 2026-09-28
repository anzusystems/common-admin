import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useNestedListEditorController } from '@/labs/listEditor/composables/useNestedListEditorController'
import type { NestedTree, NestedTreeNode } from '@/labs/listEditor/types/listEditorTypes'

interface Row {
  id: number
  title: string
  position: number
  parent: number | null
}

const node = (data: Row, children: NestedTreeNode<Row>[] = []): NestedTreeNode<Row> => ({
  data,
  children,
  meta: { dirty: false },
})
// Sparse, meaningful positions (interleaved with another collection on the backend).
const tree = (): NestedTree<Row> => ({
  children: [
    node({ id: 1, title: 'Home', position: 10, parent: null }),
    node({ id: 2, title: 'News', position: 20, parent: null }, [
      node({ id: 21, title: 'Sport', position: 100, parent: 2 }),
      node({ id: 22, title: 'Weather', position: 500, parent: 2 }),
    ]),
    node({ id: 3, title: 'About', position: 310, parent: null }),
  ],
  meta: { dirty: false },
})

const setup = (position: Parameters<typeof useNestedListEditorController<Row>>[0]['position']) => {
  const store = ref<NestedTree<Row>>(tree())
  const h = useNestedListEditorController<Row>({
    get: () => store.value,
    set: (v) => (store.value = v),
    maxDepth: 2,
    position,
  })
  return { store, h }
}
const roots = (t: NestedTree<Row>) => t.children.map((n) => `${n.data.title}:${n.data.position}`)

describe('useNestedListEditorController — position option', () => {
  it('position: false leaves the position field alone on a reorder', () => {
    const { store, h } = setup(false)
    h.moveDown(1)
    expect(roots(store.value)).toEqual(['News:20', 'Home:10', 'About:310'])
    // Unmanaged: the untouched sibling must not read as edited because of a rewritten field.
    expect(h.isUnsaved(3)).toBe(false)
  })

  it("strategy 'preserve-values' moves rows through the existing slots", () => {
    const { store, h } = setup({ field: 'position', strategy: 'preserve-values' })
    h.moveDown(1)
    expect(roots(store.value)).toEqual(['News:10', 'Home:20', 'About:310'])
  })

  it("strategy 'preserve-values' does not compact on delete", () => {
    const { store, h } = setup({ field: 'position', strategy: 'preserve-values' })
    h.deleteItem(1)
    expect(roots(store.value)).toEqual(['News:20', 'About:310'])
  })
})
