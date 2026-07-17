import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useListEditorController } from '@/labs/listEditor/composables/useListEditorController'

/**
 * QA 85050 Batch 10 BUG-03 — position values must be preservable across a reorder.
 *
 * The controller renumbers on EVERY write: `write()` → `renumber()` → `renumberPositions`,
 * which assigns `(index + 1) * multiplier` to every row. For most consumers that is right —
 * positions are opaque ordinals.
 *
 * Not for CMS page contents. There the position is a meaningful ABSOLUTE number: the backend
 * (`PageContentItemsDecoratorBuilder`) merges page-content rows and auto-distribution boxes into
 * ONE list and sorts BOTH on the same numeric scale. Rewriting 10/310 into 100/200 silently MOVES
 * unrelated boxes on the live site.
 *
 * Agreed requirement: a reorder must only SWAP rows through the EXISTING position slots — the set
 * of values stays put, the row identities move through it. Renumbering stays the DEFAULT (the ~60
 * other consumers are unaffected); this is an opt-in.
 *
 * `preserve-values` is a REORDER policy, not a general write policy:
 *   move   → take the current position values, sort ascending, reassign to the new row order
 *   add    → do not invent or compact; the new row keeps the position it was given
 *   delete → keep the holes, do not compact
 *
 * The first test is a GUARD on the default: it must keep passing — the ~60 renumbering consumers
 * must not notice this option exists.
 */

interface Row {
  id: number
  title: string
  position: number
}

const setup = (
  initial: Row[],
  opts: Partial<Parameters<typeof useListEditorController<Row>>[0]> = {},
) => {
  const store = ref<Row[]>(initial.map((r) => ({ ...r })))
  const h = useListEditorController<Row>({
    get: () => store.value,
    set: (v) => (store.value = v),
    factory: () => ({ id: -99, title: 'new', position: 0 }),
    ...opts,
  })
  return { store, h }
}

const positions = (store: { value: Row[] }) => store.value.map((r) => r.position)
const titles = (store: { value: Row[] }) => store.value.map((r) => r.title)

describe('useListEditorController — position strategy', () => {
  it('GUARD: the default still renumbers to a clean (index+1)*multiplier series', () => {
    const { store, h } = setup(
      [
        { id: 1, title: 'A', position: 10 },
        { id: 2, title: 'B', position: 310 },
      ],
      { position: { field: 'position', multiplier: 100 } }
    )
    h.moveItem(0, 1)
    // Unchanged behaviour for every existing consumer: values are rewritten from array order.
    expect(titles(store)).toEqual(['B', 'A'])
    expect(positions(store)).toEqual([100, 200])
  })

  it('preserve-values: a move swaps rows THROUGH the existing slots, keeping the values', () => {
    const { store, h } = setup(
      [
        { id: 1, title: 'A', position: 10 },
        { id: 2, title: 'B', position: 310 },
      ],
      { position: { field: 'position', multiplier: 100, strategy: 'preserve-values' } }
    )
    h.moveItem(0, 1)

    // ORACLE (fails today → renumbered to [100, 200]): the slots stay {10, 310}; the rows move.
    expect(titles(store)).toEqual(['B', 'A'])
    expect(positions(store)).toEqual([10, 310])
  })

  it('preserve-values: a 3-row reorder reassigns the sorted value set to the new order', () => {
    const { store, h } = setup(
      [
        { id: 1, title: 'A', position: 10 },
        { id: 2, title: 'B', position: 100 },
        { id: 3, title: 'C', position: 310 },
      ],
      { position: { field: 'position', multiplier: 100, strategy: 'preserve-values' } }
    )
    h.moveItem(2, 0) // drag C to the top

    // ORACLE: C:10, A:100, B:310 — the value set is untouched, identities move through it.
    expect(titles(store)).toEqual(['C', 'A', 'B'])
    expect(positions(store)).toEqual([10, 100, 310])
  })

  it('preserve-values: adding a row does not rewrite the existing rows positions', () => {
    const { store, h } = setup(
      [
        { id: 1, title: 'A', position: 10 },
        { id: 2, title: 'B', position: 310 },
      ],
      { position: { field: 'position', multiplier: 100, strategy: 'preserve-values' } }
    )
    h.addItem(undefined, undefined)

    // ORACLE (fails today): the two existing rows keep 10 / 310 — add must not compact or renumber.
    expect(store.value[0].position).toBe(10)
    expect(store.value[1].position).toBe(310)
  })

  it('preserve-values: deleting a row leaves a hole rather than compacting', () => {
    const { store, h } = setup(
      [
        { id: 1, title: 'A', position: 10 },
        { id: 2, title: 'B', position: 100 },
        { id: 3, title: 'C', position: 310 },
      ],
      { position: { field: 'position', multiplier: 100, strategy: 'preserve-values' } }
    )
    h.deleteItem(2) // drop B (by key)

    // ORACLE (fails today → compacted to [100, 200]): the survivors keep their own slots.
    expect(titles(store)).toEqual(['A', 'C'])
    expect(positions(store)).toEqual([10, 310])
  })
})
