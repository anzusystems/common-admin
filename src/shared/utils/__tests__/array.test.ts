import { describe, expect, it } from 'vitest'
import { arrayFlatten, arrayFromArgs, arrayItemToggle, arraysHaveSameElements } from '@/shared/utils/array'

describe('utils/array', () => {
  describe('arrayItemToggle', () => {
    it('adds a missing value and removes a present one, in place', () => {
      const list = [1, 2]
      arrayItemToggle(list, 3)
      expect(list).toEqual([1, 2, 3])
      arrayItemToggle(list, 1)
      expect(list).toEqual([2, 3])
    })

    it('removes only the first occurrence', () => {
      const list = ['a', 'b', 'a']
      arrayItemToggle(list, 'a')
      expect(list).toEqual(['b', 'a'])
    })

    it('matches objects by identity', () => {
      const item = { id: 1 }
      const list = [item]
      arrayItemToggle(list, { id: 1 })
      expect(list).toHaveLength(2)
      arrayItemToggle(list, item)
      expect(list).toEqual([{ id: 1 }])
    })
  })

  describe('arrayFromArgs', () => {
    it('copies the array', () => {
      const source = [1, 2]
      const copy = arrayFromArgs(source)
      expect(copy).toEqual([1, 2])
      expect(copy).not.toBe(source)
    })
  })

  describe('arrayFlatten', () => {
    it('flattens any depth, keeping the order', () => {
      expect(arrayFlatten([1, [2, [3, [4]]], 5])).toEqual([1, 2, 3, 4, 5])
    })

    it('answers an empty array for empty input', () => {
      expect(arrayFlatten([])).toEqual([])
      expect(arrayFlatten([[], [[]]])).toEqual([])
    })

    it('does not mutate the input', () => {
      const input = [1, [2]]
      arrayFlatten(input)
      expect(input).toEqual([1, [2]])
    })

    // admin-dam's FileUpload flattens what the file input hands it; an empty group last in the
    // list must not throw away the files collected before it.
    it('keeps what came before an empty nested array', () => {
      expect(arrayFlatten([1, []])).toEqual([1])
      expect(arrayFlatten([1, [2, []]])).toEqual([1, 2])
      expect(arrayFlatten([[1], [[]]])).toEqual([1])
    })
  })

  describe('arraysHaveSameElements', () => {
    it('ignores the order of ids', () => {
      expect(arraysHaveSameElements([3, 1, 2], [1, 2, 3])).toBe(true)
      expect(arraysHaveSameElements([10, 9, 1], [1, 9, 10])).toBe(true)
      expect(arraysHaveSameElements(['b', 'a'], ['a', 'b'])).toBe(true)
    })

    it('compares as multisets', () => {
      expect(arraysHaveSameElements([1, 1, 2], [1, 2, 2])).toBe(false)
      expect(arraysHaveSameElements([1, 2], [1, 2, 2])).toBe(false)
      expect(arraysHaveSameElements([], [])).toBe(true)
    })

    it('does not reorder its arguments', () => {
      const a = [3, 1, 2]
      arraysHaveSameElements(a, [1, 2, 3])
      expect(a).toEqual([3, 1, 2])
    })

    it('is strict about types', () => {
      expect(arraysHaveSameElements<unknown>([1], ['1'])).toBe(false)
    })

    // Documented: the default sort stringifies, so objects keep their order and only compare
    // equal in the same order. The admins pass ids only.
    it('compares objects by identity and in the given order', () => {
      const a = { id: 1 }
      const b = { id: 2 }
      expect(arraysHaveSameElements([a, b], [a, b])).toBe(true)
      expect(arraysHaveSameElements([a, b], [b, a])).toBe(false)
    })
  })
})
