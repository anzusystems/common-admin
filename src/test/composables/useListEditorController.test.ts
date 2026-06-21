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

  it('rowState gates red: clear until unsaved or validateAll(); warning shows immediately', () => {
    const { h } = setup([{ id: 1, title: '', position: 1 }])
    const row = { id: 1, title: '', position: 1 }
    expect(h.rowState(row, 1)).toBeNull() // invalid but not unsaved/submitted
    expect(h.validateAll()).toBe(false)
    expect(h.rowState(row, 1)).toBe('invalid') // submitted -> shows
  })

  it('getPayload renumbers; getChanges splits added/updated/moved/deleted', () => {
    const { store, h } = setup([
      { id: 1, title: 'a', position: 5 },
      { id: 2, title: 'b', position: 9 },
    ])
    h.addItem({ id: -1, title: 'c', position: 0 })
    store.value[0].title = 'A'
    h.deleteItem(2)
    expect(h.getPayload().map((r) => r.position)).toEqual([1, 2])
    const ch = h.getChanges()
    expect(ch.added.map((r) => r.id)).toEqual([-1])
    expect(ch.updated.map((r) => r.id)).toEqual([1])
    expect(ch.deleted.map((r) => r.id)).toEqual([2])
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

  it('updateItem supports replace, patch, and updater fn', () => {
    const { store, h } = setup([{ id: 1, title: 'a', position: 1 }])
    h.updateItem(1, { title: 'patched' })
    expect(store.value[0].title).toBe('patched')
    h.updateItem(1, (c) => ({ ...c, title: c.title + '!' }))
    expect(store.value[0].title).toBe('patched!')
  })

  it('custom getKey fn + position:false (no renumber)', () => {
    const store = ref([
      { id: undefined, title: 'a', position: 7, slug: 'x' } as Row & { slug: string },
    ])
    const h = useListEditorController<Row & { slug: string }>({
      get: () => store.value,
      set: (v) => (store.value = v),
      factory: () => ({ id: -1, title: '', position: 0, slug: '' }),
      getKey: (i) => i.slug,
      position: false,
    })
    expect(h.isUnsaved('x')).toBe(false)
    expect(h.getPayload()[0].position).toBe(7) // not renumbered
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
})
