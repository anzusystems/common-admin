import { describe, expect, it } from 'vitest'
import { renumberPositions, sortByPosition } from '@/labs/listEditor/utils/positions'
import { nextListEditorTempId } from '@/labs/listEditor/utils/tempId'

describe('renumberPositions', () => {
  it('renumbers to sequential 1-based positions matching array order', () => {
    const items = [
      { id: 1, position: 7 },
      { id: 2, position: 1 },
      { id: 3, position: 1 },
    ]
    const result = renumberPositions(items)
    expect(result.map((i) => i.position)).toEqual([1, 2, 3])
    expect(result.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('returns already-correct items reference-equal and never mutates input', () => {
    const ok = { id: 1, position: 1 }
    const wrong = { id: 2, position: 9 }
    const items = [ok, wrong]
    const result = renumberPositions(items)
    expect(result[0]).toBe(ok)
    expect(result[1]).not.toBe(wrong)
    expect(wrong.position).toBe(9)
    expect(result[1].position).toBe(2)
  })

  it('supports custom positionField and positionMultiplier', () => {
    const items = [
      { id: 1, order: 0 },
      { id: 2, order: 0 },
    ]
    const result = renumberPositions(items, { positionField: 'order', positionMultiplier: 10 })
    expect(result.map((i) => i.order)).toEqual([10, 20])
  })

  it('handles an empty list', () => {
    expect(renumberPositions([])).toEqual([])
  })
})

describe('sortByPosition', () => {
  it('returns a copy ordered by ascending position without mutating the input', () => {
    const items = [
      { id: 1, position: 3 },
      { id: 2, position: 1 },
      { id: 3, position: 2 },
    ]
    const result = sortByPosition(items)
    expect(result.map((i) => i.id)).toEqual([2, 3, 1])
    expect(items.map((i) => i.id)).toEqual([1, 2, 3])
    expect(result).not.toBe(items)
  })
})

describe('nextListEditorTempId', () => {
  it('returns unique negative ids on every call', () => {
    const a = nextListEditorTempId()
    const b = nextListEditorTempId()
    const c = nextListEditorTempId()
    expect(a).toBeLessThan(0)
    expect(new Set([a, b, c]).size).toBe(3)
    expect(b).toBe(a - 1)
    expect(c).toBe(b - 1)
  })
})
