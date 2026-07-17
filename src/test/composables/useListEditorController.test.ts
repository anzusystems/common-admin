import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useListEditorController } from '@/labs/listEditor/composables/useListEditorController'

interface Row {
  id: number | undefined
  title: string
  position: number
}

const setup = (
  initial: Row[] = [],
  opts: Partial<Parameters<typeof useListEditorController<Row>>[0]> = {},
) => {
  const store = ref<Row[]>(initial.map((r) => ({ ...r })))
  const h = useListEditorController<Row>({
    get: () => store.value,
    set: (v) => (store.value = v),
    factory: () => ({ id: -99, title: '', position: 0 }),
    validate: (r) => r.title.length > 0,
    ...opts,
  })
  return { store, h }
}

type SlugRow = Row & { slug: string }

// Rows keyed by `slug` instead of `id`. Built here rather than inline so the assertions can read
// `store.value` (vue/no-ref-object-reactivity-loss forbids that in the ref's own scope).
const setupSlug = (initial: SlugRow[]) => {
  const store = ref<SlugRow[]>(initial.map((r) => ({ ...r })))
  const h = useListEditorController<SlugRow>({
    get: () => store.value,
    set: (v) => (store.value = v),
    factory: () => ({ id: -1, title: '', position: 0, slug: '' }),
    getKey: (i) => i.slug,
  })
  return { store, h }
}

describe('useListEditorController', () => {
  it('dirty: added row (no baseline) and edited row are unsaved; untouched is clean', () => {
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    expect(h.hasUnsaved.value).toBe(false)
    store.value = [...store.value, { id: -1, title: 'new', position: 2 }]
    expect(h.isUnsaved(-1)).toBe(true)
    expect(h.isUnsaved(1)).toBe(false)
    store.value[0].title = 'edited'
    expect(h.isUnsaved(1)).toBe(true)
  })

  it('reorder does NOT dirty rows (position excluded from the content hash)', () => {
    const { h } = setup([
      { id: 1, title: 'a', position: 1 },
      { id: 2, title: 'b', position: 2 },
    ])
    h.moveItem(0, 1) // swap; positions renumber, but only the moved key is flagged
    expect(h.isUnsaved(1)).toBe(true) // moved
    expect(h.isUnsaved(2)).toBe(false) // displaced only — stays clean
  })

  it('BUG-08/BUG-11 delete-bleed: deleting one row does NOT mark the surviving rows unsaved', () => {
    // Deleting a middle row renumbers the survivors' positions, but position is
    // excluded from the content hash — so the neighbours must stay clean (no
    // amber bleed onto siblings). The editor is still dirty overall (a saved row
    // was removed), but ONLY via the deleted set, not the survivors.
    const { h } = setup([
      { id: 1, title: 'a', position: 1 },
      { id: 2, title: 'b', position: 2 },
      { id: 3, title: 'c', position: 3 },
    ])
    expect(h.hasUnsaved.value).toBe(false)
    h.deleteItem(2)
    expect(h.hasUnsaved.value).toBe(true) // a saved row was removed
    expect(h.isUnsaved(1)).toBe(false) // neighbour above stays clean
    expect(h.isUnsaved(3)).toBe(false) // neighbour below stays clean (BUG-11)
    const ch = h.getChanges()
    expect(ch.deleted.map((r) => r.id)).toEqual([2])
    expect(ch.updated).toEqual([]) // survivors are NOT reported as edited (BUG-08)
  })

  it('validate true=valid: invalid blocks save; warning does not', () => {
    const { h } = setup([{ id: 1, title: '', position: 1 }])
    expect(h.hasErrors.value).toBe(true)
    expect(h.invalidKeys.value.has(1)).toBe(true)
    const warn = setup([{ id: 1, title: 'x', position: 1 }], {
      validate: () => ({ valid: true, state: 'warning' }),
    })
    expect(warn.h.hasErrors.value).toBe(false)
  })

  it('rowState gates red behind validateAll(); an open row stays clear', () => {
    const { h } = setup([{ id: 1, title: '', position: 1 }])
    const row = { id: 1, title: '', position: 1 }
    expect(h.rowState(row, 1)).toBeNull() // invalid on load, but untouched → no red
    expect(h.rowState(row, 1, true)).toBeNull() // being edited → no red either
    expect(h.validateAll()).toBe(false)
    expect(h.rowState(row, 1)).toBe('invalid') // a save attempt reveals it
    expect(h.rowState(row, 1, true)).toBe('invalid') // …even while the row is open
  })

  it('rowState reds an UNSAVED invalid row without any validateAll()', () => {
    // The other half of the gate: no save attempt here, the row reds purely because it is dirty.
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    expect(h.rowState(store.value[0], 1)).toBeNull() // clean + valid
    store.value[0].title = '' // now invalid AND unsaved
    expect(h.rowState(store.value[0], 1)).toBe('invalid')
    expect(h.rowState(store.value[0], 1, true)).toBeNull() // suppressed while open (still typing)
  })

  it('rowState shows a warning immediately — no dirty/submitted gate', () => {
    const { h } = setup([{ id: 1, title: 'x', position: 1 }], {
      validate: () => ({ valid: true, state: 'warning' }),
    })
    const row = { id: 1, title: 'x', position: 1 }
    expect(h.rowState(row, 1)).toBe('warning') // clean, untouched, never submitted
    expect(h.rowState(row, 1, true)).toBe('warning') // and while open
    expect(h.hasErrors.value).toBe(false) // a warning never blocks save
  })

  it('getPayload renumbers gappy store positions into a clean 1..n series', () => {
    // The positions are written DIRECTLY into the store and never touched by a controller write —
    // every addItem/deleteItem/moveItem renumbers as a side effect, so a fixture that has been
    // through one is ALREADY normalised and can no longer tell a renumbering getPayload from a
    // no-op one. Keep this test free of controller mutations.
    const { store, h } = setup([
      { id: 1, title: 'a', position: 5 },
      { id: 2, title: 'b', position: 9 },
      { id: 3, title: 'c', position: 2 },
    ])
    expect(h.getPayload().map((r) => r.position)).toEqual([1, 2, 3])
    expect(h.getPayload().map((r) => r.id)).toEqual([1, 2, 3]) // array order wins, not position order
    expect(store.value.map((r) => r.position)).toEqual([5, 9, 2]) // non-mutating: the store is untouched
  })

  it('getPayload applies the position multiplier and honours a custom payload fn', () => {
    const { h } = setup([
      { id: 1, title: 'a', position: 5 },
      { id: 2, title: 'b', position: 9 },
    ])
    expect(h.getPayload().map((r) => r.position)).toEqual([1, 2])

    const tenfold = setup(
      [
        { id: 1, title: 'a', position: 5 },
        { id: 2, title: 'b', position: 9 },
      ],
      { position: { field: 'position', multiplier: 10 } },
    )
    expect(tenfold.h.getPayload().map((r) => r.position)).toEqual([10, 20])

    // `payload` fully replaces the built-in renumber.
    const custom = setup([{ id: 1, title: 'a', position: 5 }], {
      payload: (items) => items.map((r) => ({ ...r, title: r.title.toUpperCase() })),
    })
    expect(custom.h.getPayload()).toEqual([{ id: 1, title: 'A', position: 5 }])
  })

  it('getChanges splits added/updated/moved/deleted', () => {
    const { store, h } = setup([
      { id: 1, title: 'a', position: 1 },
      { id: 2, title: 'b', position: 2 },
      { id: 3, title: 'c', position: 3 },
    ])
    h.addItem({ id: -1, title: 'd', position: 0 })
    store.value[0].title = 'A' // edit row 1
    h.moveItem(2, 0) // drag row 3 to the top → moved, but its CONTENT is unchanged
    h.deleteItem(2)
    const ch = h.getChanges()
    expect(ch.added.map((r) => r.id)).toEqual([-1])
    expect(ch.updated.map((r) => r.id)).toEqual([1])
    expect(ch.moved.map((r) => r.id)).toEqual([3]) // content-invisible: only the declared move set knows
    expect(ch.deleted.map((r) => r.id)).toEqual([2])
    expect(ch.reparented).toEqual([]) // flat list — never reparents
  })

  it('commit backfills id-less saved rows, advances baseline, clears unsaved', () => {
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    h.addItem({ id: -1, title: 'b', position: 2 })
    expect(h.isUnsaved(-1)).toBe(true) // an ADDED temp row is unsaved (init rows are the baseline)
    // server echoes saved rows WITHOUT an id (the BUG-06 shape)
    h.commit([
      { id: undefined, title: 'a', position: 1 },
      { id: undefined, title: 'b', position: 2 },
    ])
    expect(h.hasUnsaved.value).toBe(false)
    expect(store.value).toHaveLength(2) // both rows survive the commit — none dropped
    expect(store.value.map((r) => r.title)).toEqual(['a', 'b'])
    for (const r of store.value) expect(typeof r.id).toBe('number')
    expect(store.value[0].id).not.toBe(store.value[1].id)
  })

  it('reset restores the last committed baseline and clears unsaved', () => {
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    h.addItem({ id: -1, title: 'tmp', position: 2 })
    store.value[0].title = 'edited'
    expect(h.hasUnsaved.value).toBe(true)
    h.reset()
    expect(h.hasUnsaved.value).toBe(false)
    expect(store.value).toHaveLength(1)
    expect(store.value[0].title).toBe('a')
  })

  // NOTE: there is NO replace mode — an object `next` is ALWAYS `{ ...current, ...next }`. The
  // previous name ("supports replace, patch, and updater fn") promised one, and the
  // `next: TItem | Partial<TItem>` signature still implies it. Only the updater fn can replace.
  it('updateItem merges an object patch (never replaces); an updater fn is applied verbatim', () => {
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    h.updateItem(1, { title: 'patched' })
    expect(store.value[0].title).toBe('patched')
    expect(store.value[0].id).toBe(1) // fields the patch omits SURVIVE — a merge, not a swap
    expect(store.value[0].position).toBe(1)

    // Passing a whole `TItem` is still a merge, not a replace: this is the trap the type implies.
    h.updateItem(1, { title: 'whole' } as Row)
    expect(store.value[0]).toEqual({ id: 1, title: 'whole', position: 1 })

    h.updateItem(1, (c) => ({ ...c, title: c.title + '!' }))
    expect(store.value[0].title).toBe('whole!')
  })

  it('updateItem on an unknown key is a no-op', () => {
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    h.updateItem(999, { title: 'ghost' })
    expect(store.value).toEqual([{ id: 1, title: 'a', position: 1 }])
    expect(h.hasUnsaved.value).toBe(false)
  })

  it('custom getKey fn: every key-addressed op resolves rows by that field, not by id', () => {
    // The rows carry NO id on purpose — if the controller fell back to `id`, every key would be
    // `undefined` and each assertion below would resolve nothing. Negative checks like
    // `isUnsaved('x') === false` cannot see that (a broken key is simply absent from the set), so
    // every oracle here is POSITIVE: address a row by its slug and require the effect to land.
    const { store, h } = setupSlug([
      { id: undefined, title: 'a', position: 1, slug: 'x' },
      { id: undefined, title: 'b', position: 2, slug: 'y' },
    ])
    expect(h.isUnsaved('x')).toBe(false) // clean load, keyed by slug

    h.updateItem('x', { title: 'edited' }) // found BY slug
    expect(store.value[0].title).toBe('edited')
    expect(h.isUnsaved('x')).toBe(true) // and reported unsaved under the slug key
    expect(h.isUnsaved('y')).toBe(false)
    expect(h.getChanges().updated.map((r) => r.slug)).toEqual(['x'])

    h.deleteItem('y') // removed BY slug
    expect(store.value.map((r) => r.slug)).toEqual(['x'])
    expect(h.getChanges().deleted.map((r) => r.slug)).toEqual(['y'])

    const off = h.registerValidity('x', () => false)
    expect(h.invalidKeys.value.has('x')).toBe(true) // validity registers under the slug key too
    off()
  })

  it('position:false leaves positions alone and makes them count as row content', () => {
    const store = ref([
      { id: 1, title: 'a', position: 7 } as Row,
      { id: 2, title: 'b', position: 3 } as Row,
    ])
    const h = useListEditorController<Row>({
      get: () => store.value,
      set: (v) => (store.value = v),
      factory: () => ({ id: -1, title: '', position: 0 }),
      position: false,
    })
    expect(h.getPayload().map((r) => r.position)).toEqual([7, 3]) // not renumbered
    // Unmanaged position is ordinary content, so editing it DOES dirty the row (the managed
    // default strips position from the hash so a reorder never lights a row amber).
    store.value[0].position = 8
    expect(h.isUnsaved(1)).toBe(true)
    expect(h.isUnsaved(2)).toBe(false)

    const managed = setup([{ id: 1, title: 'a', position: 7 }])
    managed.store.value[0].position = 8
    expect(managed.h.isUnsaved(1)).toBe(false) // managed → position excluded from the hash
  })

  it('dirtyExclude: an excluded field change does not dirty the row but stays in the payload', () => {
    const store = ref([{ id: 1, title: 'a', position: 1, points: 0 } as Row & { points: number }])
    const h = useListEditorController<Row & { points: number }>({
      get: () => store.value,
      set: (v) => (store.value = v),
      factory: () => ({ id: -1, title: '', position: 0, points: 0 }),
      validate: (r) => r.title.length > 0,
      dirtyExclude: ['points'],
    })
    expect(h.isUnsaved(1)).toBe(false)
    store.value[0].points = 1 // excluded field → not dirty
    expect(h.isUnsaved(1)).toBe(false)
    expect(h.getPayload()[0].points).toBe(1) // but still carried in the payload
    store.value[0].title = 'b' // a non-excluded field still dirties
    expect(h.isUnsaved(1)).toBe(true)
  })

  it('dirtyExclude is reactive: changing the excluded set re-baselines dirty synchronously', () => {
    const exclude = ref<string[]>([])
    const store = ref([{ id: 1, title: 'a', position: 1, points: 0 } as Row & { points: number }])
    const h = useListEditorController<Row & { points: number }>({
      get: () => store.value,
      set: (v) => (store.value = v),
      factory: () => ({ id: -1, title: '', position: 0, points: 0 }),
      validate: (r) => r.title.length > 0,
      dirtyExclude: () => exclude.value,
    })
    store.value[0].points = 5
    expect(h.isUnsaved(1)).toBe(true) // points NOT excluded → dirty
    exclude.value = ['points'] // exclude it reactively (sync watch re-hashes baseline)
    expect(h.isUnsaved(1)).toBe(false) // now clean — no transient amber
    exclude.value = [] // and back
    expect(h.isUnsaved(1)).toBe(true)
  })

  it('registerValidity escape hatch overrides validate for that row', () => {
    const { h } = setup([{ id: 1, title: 'ok', position: 1 }])
    expect(h.invalidKeys.value.has(1)).toBe(false)
    const off = h.registerValidity(1, () => false) // form reports invalid
    expect(h.invalidKeys.value.has(1)).toBe(true)
    off()
    expect(h.invalidKeys.value.has(1)).toBe(false)
  })

  it('restoreDeleted un-tombstones a deferred-deleted row (the reorder-Cancel path)', () => {
    const { h } = setup([
      { id: 1, title: 'a', position: 1 },
      { id: 2, title: 'b', position: 2 },
    ])
    h.deleteItem(1) // deferred: the row is gone from the list but tombstoned until save
    expect(h.getChanges().deleted.map((r) => r.id)).toEqual([1])
    expect(h.unsavedCount.value).toBe(1)
    expect(h.hasUnsaved.value).toBe(true)

    h.restoreDeleted(1) // Cancel: drop the deletion record
    expect(h.getChanges().deleted).toEqual([])
    expect(h.unsavedCount.value).toBe(0)
    expect(h.hasUnsaved.value).toBe(false) // the tombstone was the ONLY unconfirmed change
  })

  it('restoreDeleted only clears the named key and ignores unknown keys', () => {
    const { h } = setup([
      { id: 1, title: 'a', position: 1 },
      { id: 2, title: 'b', position: 2 },
      { id: 3, title: 'c', position: 3 },
    ])
    h.deleteItem(1)
    h.deleteItem(3)
    h.restoreDeleted(999) // unknown → no-op, must not wipe the set
    expect(h.getChanges().deleted.map((r) => r.id)).toEqual([1, 3])
    h.restoreDeleted(1)
    expect(h.getChanges().deleted.map((r) => r.id)).toEqual([3]) // only row 1 restored
    expect(h.unsavedCount.value).toBe(1)
  })

  it('isDirty overrides the default content-diff and is handed the BASELINE row', () => {
    const store = ref([{ id: 1, title: 'a', position: 1, points: 0 } as Row & { points: number }])
    const h = useListEditorController<Row & { points: number }>({
      get: () => store.value,
      set: (v) => (store.value = v),
      factory: () => ({ id: -1, title: '', position: 0, points: 0 }),
      // Only `title` counts. If `saved` were the LIVE row instead of the baseline, this could never
      // return true — so the title assertion below also pins WHICH row the predicate receives.
      isDirty: (current, saved) => current.title !== saved?.title,
    })
    expect(h.isUnsaved(1)).toBe(false)

    store.value[0].points = 99 // the DEFAULT hash would dirty on this; the custom predicate ignores it
    expect(h.isUnsaved(1)).toBe(false)
    expect(h.hasUnsaved.value).toBe(false)

    store.value[0].title = 'b' // the one field the predicate watches
    expect(h.isUnsaved(1)).toBe(true)
    expect(h.hasUnsaved.value).toBe(true)
  })

  it('normalizeSaved rewrites server rows before they become the store AND the baseline', () => {
    const { store, h } = setup(
      [
        { id: 1, title: 'a', position: 1 },
        { id: 2, title: 'b', position: 2 },
      ],
      { normalizeSaved: (rows) => [...rows].sort((a, b) => a.position - b.position) },
    )
    // The server echoes the saved rows out of position order.
    h.commit([
      { id: 2, title: 'b', position: 2 },
      { id: 1, title: 'a', position: 1 },
    ])
    expect(store.value.map((r) => r.id)).toEqual([1, 2]) // normalized back into position order
    expect(h.hasUnsaved.value).toBe(false) // …and THAT normalized shape is the new baseline
  })

  it('commitKey resolves a saved row identity, suppressing the temp-id backfill', () => {
    // Default: a server row with no id gets a minted temp id (covered above). commitKey lets the
    // consumer declare the row's identity instead — a NON-nullish result means "this row already has
    // an identity", so no temp id is minted. Returning nullish falls back to minting.
    const seen: Array<{ saved: string; previous: string | undefined }> = []
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }], {
      commitKey: (saved, previous) => {
        seen.push({ saved: saved.title, previous: previous?.title })
        return saved.title === 'keep' ? 'declared-key' : (undefined as unknown as number)
      },
    })
    h.commit([
      { id: undefined, title: 'keep', position: 1 },
      { id: undefined, title: 'mint', position: 2 },
    ])
    expect(seen.map((s) => s.saved)).toEqual(['keep', 'mint']) // called per saved row
    expect(store.value[0].id).toBeUndefined() // identity declared → left exactly as the server sent it
    expect(typeof store.value[1].id).toBe('number') // nullish → temp id minted
    expect(store.value[1].id! < 0).toBe(true)
  })
})
