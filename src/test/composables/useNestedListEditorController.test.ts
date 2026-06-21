import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useNestedListEditorController } from '@/labs/listEditor/composables/useNestedListEditorController'
import type { NestedTree, NestedTreeNode } from '@/labs/listEditor/types/listEditorTypes'

interface Row {
  id: number | undefined
  title: string
  position: number
  parent: number | null
}

// Helper for the `Row` fixtures. A separate generic builder (`gnode`) covers the
// one test that uses an extended row shape (slug), so the common path keeps a
// tight `Row` type without per-call generic annotations.
const node = (data: Row, children: NestedTreeNode<Row>[] = []): NestedTreeNode<Row> => ({
  data,
  children,
  meta: { dirty: false },
})
const gnode = <T>(data: T, children: NestedTreeNode<T>[] = []): NestedTreeNode<T> => ({
  data,
  children,
  meta: { dirty: false },
})

// Fixture: Home / News[Sport, Weather] / About (mirrors the component test tree).
const tree = (): NestedTree<Row> => ({
  children: [
    node({ id: 1, title: 'Home', position: 1, parent: null }),
    node({ id: 2, title: 'News', position: 2, parent: null }, [
      node({ id: 21, title: 'Sport', position: 1, parent: 2 }),
      node({ id: 22, title: 'Weather', position: 2, parent: 2 }),
    ]),
    node({ id: 3, title: 'About', position: 3, parent: null }),
  ],
  meta: { dirty: false },
})

const setup = (
  initial: NestedTree<Row> = tree(),
  opts: Partial<Parameters<typeof useNestedListEditorController<Row>>[0]> = {},
) => {
  const store = ref<NestedTree<Row>>(JSON.parse(JSON.stringify(initial)) as NestedTree<Row>)
  const h = useNestedListEditorController<Row>({
    get: () => store.value,
    set: (v) => (store.value = v),
    factory: () => ({ id: -99, title: '', position: 0, parent: null }),
    maxDepth: 2,
    validate: (r) => r.title.length > 0,
    ...opts,
  })
  return { store, h }
}

describe('useNestedListEditorController', () => {
  it('items flattens the tree depth-first in render order', () => {
    const { h } = setup()
    expect(h.items.value.map((r) => r.id)).toEqual([1, 2, 21, 22, 3])
  })

  it('dirty: added row (no baseline) and edited row are unsaved; untouched is clean', () => {
    const { store, h } = setup()
    expect(h.hasUnsaved.value).toBe(false)
    // Add a child to News through the handle (a brand-new row → unsaved).
    h.addChild(2, { id: -1, title: 'New', position: 0, parent: 2 })
    expect(h.isUnsaved(-1)).toBe(true)
    expect(h.isUnsaved(1)).toBe(false)
    // Edit Home in place → its content hash diverges from the baseline.
    store.value.children[0].data.title = 'Home edited'
    expect(h.isUnsaved(1)).toBe(true)
  })

  it('pure position reorder is NOT amber via the controller (mirrors the flat editor; position excluded)', () => {
    const { h } = setup()
    expect(h.moveDown(1)).toBe(true) // Home <-> News at root — content + parent unchanged
    // The controller's `isUnsaved` excludes pure position renumbers, exactly
    // like a displaced row in the flat editor. The editor layers the
    // actively-moved row's amber on top via its reorder-session moved set.
    expect(h.isUnsaved(1)).toBe(false)
    expect(h.items.value.map((r) => r.id)).toEqual([2, 21, 22, 1, 3])
    // The positions are still renumbered for persistence, and `getChanges().moved`
    // reports the rows whose position changed (meta.dirty).
    expect(h.getChanges().moved.map((r) => r.id)).toContain(1)
  })

  it('indent reparents and flags dirty even though the position number may be unchanged (BUG-13)', () => {
    const { store, h } = setup()
    // About (id=3, pos 3 at root) indented under News becomes News' 3rd child.
    expect(h.indent(3)).toBe(true)
    const news = store.value.children.find((n) => n.data.id === 2)!
    expect(news.children!.map((c) => c.data.id)).toEqual([21, 22, 3])
    expect(h.isUnsaved(3)).toBe(true)
    const ch = h.getChanges()
    expect(ch.reparented.map((r) => r.id)).toContain(3)
  })

  it("BUG-13: a parent's only/first child dragged out to root lands after the parent, not at index 0", () => {
    // Mirrors the QA video: testED0 has the single child testED1; testED2..4 at
    // root. Dragging testED1 out and dropping it just below testED0 (root depth)
    // → computeInstruction yields moveTo(testED1, null, index=1) = root AFTER the
    // parent. It must NOT collapse to root index 0 (above the parent).
    const t: NestedTree<Row> = {
      children: [
        node({ id: 1, title: 'ED0', position: 1, parent: null }, [
          node({ id: 11, title: 'ED1', position: 1, parent: 1 }),
        ]),
        node({ id: 2, title: 'ED2', position: 2, parent: null }),
        node({ id: 3, title: 'ED3', position: 3, parent: null }),
        node({ id: 4, title: 'ED4', position: 4, parent: null }),
      ],
      meta: { dirty: false },
    }
    const { store, h } = setup(t)
    expect(h.moveTo(11, null, 1)).toBe(true)
    expect(h.items.value.map((r) => r.id)).toEqual([1, 11, 2, 3, 4]) // ED1 after ED0, not before
    expect(store.value.children[0].children ?? []).toHaveLength(0) // ED0 now childless
    expect(h.isUnsaved(11)).toBe(true) // reparented → amber + persisted
  })

  it('BUG-13: the LAST child dragged out to root after its parent lands correctly', () => {
    const t: NestedTree<Row> = {
      children: [
        node({ id: 1, title: 'A', position: 1, parent: null }, [
          node({ id: 11, title: 'B', position: 1, parent: 1 }),
          node({ id: 12, title: 'C', position: 2, parent: 1 }),
        ]),
        node({ id: 2, title: 'D', position: 2, parent: null }),
      ],
      meta: { dirty: false },
    }
    const { h } = setup(t)
    expect(h.moveTo(12, null, 1)).toBe(true) // last child C out, just after parent A
    expect(h.items.value.map((r) => r.id)).toEqual([1, 11, 12, 2]) // A, B(child), C(root), D
    expect(h.isUnsaved(12)).toBe(true)
  })

  it('BUG-13 (root cause): a reparent with UNCHANGED position number is still flagged + persisted', () => {
    // The crux of the QA-video bug: drag a child OUT (it lands correctly in the
    // UI) but the reparent keeps the same position NUMBER, so the pre-fix
    // position-only dirty check omitted it from the save → it reverted on reload
    // and looked like it "landed in the wrong position". Setup: A (pos1) owns
    // child B (pos1); C is root pos2. Move C under A as its 2nd child → C's
    // position stays 2, only its parent changes (null → A). It must still read
    // unsaved + appear in the change-set + carry the new parent in the payload.
    const t: NestedTree<Row> = {
      children: [
        node({ id: 1, title: 'A', position: 1, parent: null }, [
          node({ id: 11, title: 'B', position: 1, parent: 1 }),
        ]),
        node({ id: 2, title: 'C', position: 2, parent: null }),
      ],
      meta: { dirty: false },
    }
    const { h } = setup(t)
    expect(h.moveTo(2, 1, 1)).toBe(true) // C → A's 2nd child
    const payloadC = h.getPayload().find((row) => row.id === 2)!
    expect(payloadC.position).toBe(2) // position NUMBER unchanged (the trap)
    expect(payloadC.parent).toBe(1) // but the new parent is carried for persistence
    expect(h.isUnsaved(2)).toBe(true) // flagged despite same position number
    expect(h.getChanges().reparented.map((row) => row.id)).toContain(2)
    // After the server echoes the saved tree and we re-baseline, C stays put.
    h.commit()
    expect(h.isUnsaved(2)).toBe(false)
    expect(h.items.value.map((row) => row.id)).toEqual([1, 11, 2]) // C remains A's child
  })

  it('validate true=valid: invalid blocks save; warning does not', () => {
    const { h } = setup(tree(), { validate: (r) => r.title.length > 0 })
    expect(h.hasErrors.value).toBe(false)
    // Empty a title → invalid.
    const bad = setup(
      {
        children: [node({ id: 1, title: '', position: 1, parent: null })],
        meta: { dirty: false },
      },
      { validate: (r) => r.title.length > 0 },
    )
    expect(bad.h.hasErrors.value).toBe(true)
    expect(bad.h.invalidKeys.value.has(1)).toBe(true)
    const warn = setup(
      {
        children: [node({ id: 1, title: 'x', position: 1, parent: null })],
        meta: { dirty: false },
      },
      { validate: () => ({ valid: true, state: 'warning' }) },
    )
    expect(warn.h.hasErrors.value).toBe(false)
  })

  it('rowState gates red: clear until unsaved or validateAll(); warning shows immediately', () => {
    const { h } = setup(
      {
        children: [node({ id: 1, title: '', position: 1, parent: null })],
        meta: { dirty: false },
      },
      { validate: (r) => r.title.length > 0 },
    )
    const row = { id: 1, title: '', position: 1, parent: null }
    expect(h.rowState(row, 1)).toBeNull() // invalid but not unsaved/submitted
    expect(h.validateAll()).toBe(false)
    expect(h.rowState(row, 1)).toBe('invalid') // submitted -> shows
  })

  it('getPayload flattens ordered rows carrying resolved position + parent key', () => {
    const { h } = setup()
    h.moveDown(1) // reshuffle root order → positions renumber
    const payload = h.getPayload()
    expect(payload.map((r) => r.id)).toEqual([2, 21, 22, 1, 3])
    // Root rows carry parent=null; News' children carry parent=2 (News' key).
    const sport = payload.find((r) => r.id === 21)!
    expect(sport.parent).toBe(2)
    expect(sport.position).toBe(1)
    const aboutNow = payload.find((r) => r.id === 3)!
    expect(aboutNow.parent).toBe(null)
  })

  it('getChanges splits added/updated/deleted', () => {
    const { store, h } = setup()
    h.addChild(1, { id: -1, title: 'Sub', position: 0, parent: 1 }) // new under Home
    store.value.children[2].data.title = 'About!' // edit About
    h.deleteItem(21) // remove Sport (a previously-saved row)
    const ch = h.getChanges()
    expect(ch.added.map((r) => r.id)).toEqual([-1])
    expect(ch.updated.map((r) => r.id)).toEqual([3])
    expect(ch.deleted.map((r) => r.id)).toEqual([21])
  })

  it('commit backfills id-less saved rows, advances baseline, clears unsaved', () => {
    const { h } = setup()
    h.addChild(1, { id: -1, title: 'Sub', position: 0, parent: 1 })
    expect(h.isUnsaved(-1)).toBe(true)
    // Server echoes the saved tree WITHOUT ids on the new rows.
    const saved: NestedTree<Row> = {
      children: [
        node({ id: undefined, title: 'Home', position: 1, parent: null }, [
          node({ id: undefined, title: 'Sub', position: 1, parent: null }),
        ]),
      ],
      meta: { dirty: false },
    }
    h.commit(saved)
    expect(h.hasUnsaved.value).toBe(false)
    for (const r of h.items.value) expect(typeof r.id).toBe('number')
    expect(h.items.value[0].id).not.toBe(h.items.value[1].id)
  })

  it('commit (no arg) re-baselines the current tree and clears meta.dirty', () => {
    const { store, h } = setup()
    h.indent(3) // reparent About under News — genuinely unsaved (parent changed)
    expect(h.hasUnsaved.value).toBe(true)
    h.commit()
    expect(h.hasUnsaved.value).toBe(false)
    // meta.dirty cleared across the tree.
    const allClean = (): boolean => {
      let clean = true
      const walk = (nodes: typeof store.value.children) => {
        for (const n of nodes) {
          if (n.meta.dirty) clean = false
          if (n.children?.length) walk(n.children)
        }
      }
      walk(store.value.children)
      return clean
    }
    expect(allClean()).toBe(true)
  })

  it('reset restores the last committed baseline and clears unsaved', () => {
    const { store, h } = setup()
    h.addChild(1, { id: -1, title: 'tmp', position: 0, parent: 1 })
    store.value.children[0].data.title = 'edited'
    expect(h.hasUnsaved.value).toBe(true)
    h.reset()
    expect(h.hasUnsaved.value).toBe(false)
    expect(h.items.value.map((r) => r.id)).toEqual([1, 2, 21, 22, 3])
    expect(store.value.children[0].data.title).toBe('Home')
  })

  it('custom getKey fn + position:false (no renumber on payload)', () => {
    const store = ref<NestedTree<Row & { slug: string }>>({
      children: [gnode({ id: undefined, title: 'a', position: 7, parent: null, slug: 'x' })],
      meta: { dirty: false },
    })
    const h = useNestedListEditorController<Row & { slug: string }>({
      get: () => store.value,
      set: (v) => (store.value = v),
      factory: () => ({ id: -1, title: '', position: 0, parent: null, slug: '' }),
      getKey: (i) => i.slug,
      position: false,
      maxDepth: 2,
    })
    expect(h.isUnsaved('x')).toBe(false)
    expect(h.getPayload()[0].position).toBe(7) // not renumbered
  })

  it('registerValidity escape hatch overrides validate for that row', () => {
    const { h } = setup()
    expect(h.invalidKeys.value.has(1)).toBe(false)
    const off = h.registerValidity(1, () => false) // form reports invalid
    expect(h.invalidKeys.value.has(1)).toBe(true)
    off()
    expect(h.invalidKeys.value.has(1)).toBe(false)
  })

  it('addItem with no factory + no item is a no-op (read-only tree)', () => {
    const store = ref<NestedTree<Row>>(tree())
    const h = useNestedListEditorController<Row>({
      get: () => store.value,
      set: (v) => (store.value = v),
      maxDepth: 2,
    })
    h.addItem() // no factory configured
    expect(h.items.value).toHaveLength(5)
  })
})
