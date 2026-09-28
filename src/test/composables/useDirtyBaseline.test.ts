import { describe, expect, it } from 'vitest'
import { useDirtyBaseline } from '@/labs/listEditor/composables/useDirtyBaseline'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

interface Item {
  id: number
  position?: number
  parent?: ListEditorKey | null
  title: string
  meta?: { tag: string }
}

describe('useDirtyBaseline', () => {
  describe('initial baseline', () => {
    it('captures stringified content for every entry on first run', () => {
      const items: Item[] = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ]
      const { dirtyBaseline } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      expect(dirtyBaseline.value.size).toBe(2)
      // The name's actual claim is the stringified CONTENT — key presence alone would survive a
      // baseline that stored nothing (or every row's hash under one key).
      expect(dirtyBaseline.value.get(1)).toBe(JSON.stringify({ id: 1, title: 'A' }))
      expect(dirtyBaseline.value.get(2)).toBe(JSON.stringify({ id: 2, title: 'B' }))
    })
  })

  describe('isItemDirty', () => {
    it('returns false for unchanged data', () => {
      const items: Item[] = [{ id: 1, title: 'A' }]
      const { isItemDirty } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      expect(isItemDirty(1, items[0])).toBe(false)
    })

    it('returns true after a field changes', () => {
      const items: Item[] = [{ id: 1, title: 'A' }]
      const { isItemDirty } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      // Mutate in place — the live data has the new title; baseline kept the old.
      items[0].title = 'A-changed'
      expect(isItemDirty(1, items[0])).toBe(true)
    })

    it('returns true for keys without a baseline (newly added rows)', () => {
      const items: Item[] = [{ id: 1, title: 'A' }]
      const { isItemDirty } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      // Key 99 isn't in the baseline → treated as dirty by default.
      expect(isItemDirty(99, { id: 99, title: 'New' } as Item)).toBe(true)
    })
  })

  describe('excludeFields', () => {
    it('strips listed fields before stringifying — position-only changes do not flag dirty', () => {
      const items: Item[] = [{ id: 1, position: 1, title: 'A' }]
      const { isItemDirty } = useDirtyBaseline<Item>(
        () => items.map((it) => ({ key: it.id, data: it })),
        { excludeFields: ['position'] },
      )
      // Position rewrite (sortable does this on every move) should NOT flag
      // a row as dirty — that's exactly what `excludeFields` is for.
      items[0].position = 5
      expect(isItemDirty(1, items[0])).toBe(false)
    })

    it('still flags dirty when a non-excluded field changes alongside an excluded one', () => {
      const items: Item[] = [{ id: 1, position: 1, title: 'A' }]
      const { isItemDirty } = useDirtyBaseline<Item>(
        () => items.map((it) => ({ key: it.id, data: it })),
        { excludeFields: ['position'] },
      )
      items[0].position = 5
      items[0].title = 'A-changed'
      expect(isItemDirty(1, items[0])).toBe(true)
    })

    it('handles multiple excluded fields (nested editor: position + parent)', () => {
      const items: Item[] = [{ id: 1, position: 1, parent: null, title: 'A' }]
      const { isItemDirty } = useDirtyBaseline<Item>(
        () => items.map((it) => ({ key: it.id, data: it })),
        { excludeFields: ['position', 'parent'] },
      )
      items[0].position = 5
      items[0].parent = 99
      expect(isItemDirty(1, items[0])).toBe(false)
    })
  })

  describe('captureDirtyBaseline (rebaseline all)', () => {
    it('makes a previously-dirty item clean again', () => {
      const items: Item[] = [{ id: 1, title: 'A' }]
      const { isItemDirty, captureDirtyBaseline } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      items[0].title = 'A-changed'
      expect(isItemDirty(1, items[0])).toBe(true)
      // Consumer signals: this is the new "saved" state.
      captureDirtyBaseline()
      expect(isItemDirty(1, items[0])).toBe(false)
    })

    it('drops baseline entries for keys that no longer exist', () => {
      const items: Item[] = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ]
      const { dirtyBaseline, captureDirtyBaseline } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      expect(dirtyBaseline.value.size).toBe(2)
      // Item 2 deleted externally
      items.splice(1, 1)
      captureDirtyBaseline()
      expect(dirtyBaseline.value.size).toBe(1)
      expect(dirtyBaseline.value.has(1)).toBe(true)
      expect(dirtyBaseline.value.has(2)).toBe(false)
    })
  })

  describe('rebaselineKey (per-row)', () => {
    it('clears dirty for one row without affecting others', () => {
      const items: Item[] = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ]
      const { isItemDirty, rebaselineKey } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      items[0].title = 'A-changed'
      items[1].title = 'B-changed'
      expect(isItemDirty(1, items[0])).toBe(true)
      expect(isItemDirty(2, items[1])).toBe(true)
      rebaselineKey(1)
      expect(isItemDirty(1, items[0])).toBe(false)
      expect(isItemDirty(2, items[1])).toBe(true)
    })

    it('removes baseline entry when the key is gone', () => {
      const items: Item[] = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ]
      const { dirtyBaseline, rebaselineKey } = useDirtyBaseline<Item>(() =>
        items.map((it) => ({ key: it.id, data: it })),
      )
      // Item 2 deleted, then rebaseline its key — baseline should drop it
      items.splice(1, 1)
      rebaselineKey(2)
      expect(dirtyBaseline.value.has(2)).toBe(false)
    })
  })

  describe('stringifyContent (exposed)', () => {
    it('strips excluded fields so equivalent payloads stringify identically', () => {
      const { stringifyContent } = useDirtyBaseline<Item>(() => [], {
        excludeFields: ['position'],
      })
      const withPos = stringifyContent({ id: 1, title: 'A', position: 1 })
      const withoutPos = stringifyContent({ id: 1, title: 'A' })
      expect(withPos).toBe(withoutPos)
    })

    it('preserves nested shape when no excludes specified', () => {
      const { stringifyContent } = useDirtyBaseline<Item>(() => [])
      const result = stringifyContent({
        id: 1,
        title: 'A',
        meta: { tag: 'x' },
      })
      expect(JSON.parse(result)).toEqual({
        id: 1,
        title: 'A',
        meta: { tag: 'x' },
      })
    })
  })
})
