/* eslint-disable vue/no-ref-object-reactivity-loss */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'

interface Item {
  id: number
  position: number
  title: string
}

const makeItems = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    position: (i + 1) * 10,
    title: `Item ${i + 1}`,
  }))

describe('useListEditor', () => {
  describe('viewItems', () => {
    it('transforms model into view items with key/index/raw/position', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)

      expect(api.viewItems.value).toEqual([
        { key: 1, index: 0, raw: model.value[0], position: 10 },
        { key: 2, index: 1, raw: model.value[1], position: 20 },
        { key: 3, index: 2, raw: model.value[2], position: 30 },
      ])
    })

    it('reacts to model changes', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model)
      expect(api.viewItems.value).toHaveLength(2)

      model.value = makeItems(4)
      expect(api.viewItems.value).toHaveLength(4)
      expect(api.viewItems.value[3].key).toBe(4)
    })

    it('uses custom keyField and positionField', () => {
      interface Alt {
        uuid: string
        order: number
      }
      const model = ref<Alt[]>([
        { uuid: 'a', order: 5 },
        { uuid: 'b', order: 7 },
      ])
      const api = useListEditor<Alt>(model, { keyField: 'uuid', positionField: 'order' })

      expect(api.viewItems.value).toEqual([
        { key: 'a', index: 0, raw: model.value[0], position: 5 },
        { key: 'b', index: 1, raw: model.value[1], position: 7 },
      ])
    })
  })

  describe('addItem', () => {
    it('adds at end when no hint given', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      const result = api.addItem(newItem)

      expect(result).toHaveLength(3)
      expect(result[2]).toBe(newItem)
      expect(model.value.map((i) => i.id)).toEqual([1, 2, 99])
    })

    it('adds after given id', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem, { afterId: 1 })

      expect(model.value.map((i) => i.id)).toEqual([1, 99, 2, 3])
    })

    it('adds at end when afterId is not found', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem, { afterId: 999 })

      expect(model.value.map((i) => i.id)).toEqual([1, 2, 99])
    })

    it('adds after given index', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem, { afterIndex: 0 })

      expect(model.value.map((i) => i.id)).toEqual([1, 99, 2, 3])
    })

    it('adds at exact index when index hint is given', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem, { index: 0 })

      expect(model.value.map((i) => i.id)).toEqual([99, 1, 2, 3])
    })

    it('clamps index hint to array length', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem, { index: 100 })

      expect(model.value[model.value.length - 1]).toEqual(newItem)
    })

    it('recalculates positions when updatePosition=true', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model, { updatePosition: true })
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem, { afterId: 1 })

      expect(model.value.map((i) => [i.id, i.position])).toEqual([
        [1, 1],
        [99, 2],
        [2, 3],
      ])
    })

    it('does not recalculate positions when updatePosition is false/default', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model)
      const newItem: Item = { id: 99, position: 0, title: 'New' }

      api.addItem(newItem)

      expect(model.value.map((i) => [i.id, i.position])).toEqual([
        [1, 10],
        [2, 20],
        [99, 0],
      ])
    })
  })

  describe('deleteItem', () => {
    it('deletes by id', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)

      api.deleteItem(2)

      expect(model.value.map((i) => i.id)).toEqual([1, 3])
    })

    it('deletes by item reference', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const target = model.value[1]

      api.deleteItem(target)

      expect(model.value.map((i) => i.id)).toEqual([1, 3])
    })

    it('is a no-op for unknown id', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const before = model.value

      api.deleteItem(999)

      expect(model.value).toBe(before)
    })

    it('recalculates positions of remaining items when updatePosition=true', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model, { updatePosition: true })

      api.deleteItem(1)

      expect(model.value.map((i) => [i.id, i.position])).toEqual([
        [2, 1],
        [3, 2],
      ])
    })
  })

  describe('updateItem', () => {
    it('replaces item identified by id', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const replacement: Item = { id: 2, position: 20, title: 'Updated' }

      api.updateItem(2, replacement)

      expect(model.value[1]).toEqual(replacement)
    })

    it('replaces item identified by item reference', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const original = model.value[0]
      const replacement: Item = { id: 1, position: 10, title: 'Updated' }

      api.updateItem(original, replacement)

      expect(model.value[0]).toEqual(replacement)
      expect(model.value[0].title).toBe('Updated')
    })

    it('is a no-op for unknown id', () => {
      const model = ref<Item[]>(makeItems(2))
      const api = useListEditor<Item>(model)
      const before = model.value

      api.updateItem(999, { id: 999, position: 0, title: 'X' })

      expect(model.value).toBe(before)
    })
  })

  describe('moveItem', () => {
    it('moves by index forward', () => {
      const model = ref<Item[]>(makeItems(4))
      const api = useListEditor<Item>(model)

      api.moveItem(0, 2)

      expect(model.value.map((i) => i.id)).toEqual([2, 3, 1, 4])
    })

    it('moves by index backward', () => {
      const model = ref<Item[]>(makeItems(4))
      const api = useListEditor<Item>(model)

      api.moveItem(3, 0)

      expect(model.value.map((i) => i.id)).toEqual([4, 1, 2, 3])
    })

    it('is a no-op when from equals to', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const before = model.value

      api.moveItem(1, 1)

      expect(model.value).toBe(before)
    })

    it('is a no-op for out-of-range indices', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model)
      const before = model.value

      api.moveItem(-1, 0)
      api.moveItem(0, 99)

      expect(model.value).toBe(before)
    })

    it('recalculates positions when updatePosition=true', () => {
      const model = ref<Item[]>(makeItems(3))
      const api = useListEditor<Item>(model, { updatePosition: true })

      api.moveItem(2, 0)

      expect(model.value.map((i) => [i.id, i.position])).toEqual([
        [3, 1],
        [1, 2],
        [2, 3],
      ])
    })
  })

  describe('recalculatePositions', () => {
    it('assigns 1..N * multiplier', () => {
      const api = useListEditor<Item>(ref<Item[]>([]), { positionMultiplier: 10 })
      const input: Item[] = [
        { id: 1, position: 0, title: 'a' },
        { id: 2, position: 0, title: 'b' },
        { id: 3, position: 0, title: 'c' },
      ]

      const out = api.recalculatePositions(input)

      expect(out.map((i) => i.position)).toEqual([10, 20, 30])
    })

    it('uses multiplier 1 by default', () => {
      const api = useListEditor<Item>(ref<Item[]>([]))
      const out = api.recalculatePositions(makeItems(3))

      expect(out.map((i) => i.position)).toEqual([1, 2, 3])
    })

    it('preserves item reference when position already correct', () => {
      const api = useListEditor<Item>(ref<Item[]>([]))
      const input: Item[] = [
        { id: 1, position: 1, title: 'a' },
        { id: 2, position: 99, title: 'b' },
      ]

      const out = api.recalculatePositions(input)

      expect(out[0]).toBe(input[0])
      expect(out[1]).not.toBe(input[1])
      expect(out[1].position).toBe(2)
    })
  })

  describe('no accidental input mutation', () => {
    it('does not mutate original items or array on addItem', () => {
      const original = makeItems(3)
      const snapshot = JSON.parse(JSON.stringify(original))
      const model = ref<Item[]>(original)
      const api = useListEditor<Item>(model, { updatePosition: true })

      api.addItem({ id: 99, position: 0, title: 'New' })

      expect(original).toEqual(snapshot)
    })

    it('does not mutate original items on moveItem with updatePosition', () => {
      const original = makeItems(3)
      const snapshot = JSON.parse(JSON.stringify(original))
      const model = ref<Item[]>(original)
      const api = useListEditor<Item>(model, { updatePosition: true })

      api.moveItem(0, 2)

      expect(original).toEqual(snapshot)
    })

    it('does not mutate the items passed to recalculatePositions', () => {
      const api = useListEditor<Item>(ref<Item[]>([]))
      const input = makeItems(3)
      const snapshot = JSON.parse(JSON.stringify(input))

      api.recalculatePositions(input)

      expect(input).toEqual(snapshot)
    })

    it('writes a new array reference on mutations', () => {
      const original = makeItems(2)
      const model = ref<Item[]>(original)
      const api = useListEditor<Item>(model)

      api.addItem({ id: 99, position: 0, title: 'x' })

      expect(model.value).not.toBe(original)
    })
  })
})
