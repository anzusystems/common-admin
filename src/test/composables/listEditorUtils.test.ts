import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  preservePositionValues,
  renumberPositions,
  sortByPosition,
  sortByPositionDeep,
} from '@/labs/listEditor/utils/positions'
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

describe('preservePositionValues', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reassigns the EXISTING value set, ascending, to the current array order', () => {
    // The point of the strategy: the slot values {10, 310} are untouched, the rows move through them.
    const items = [
      { id: 'B', position: 310 },
      { id: 'A', position: 10 },
    ]
    const result = preservePositionValues(items)
    expect(result.map((i) => [i.id, i.position])).toEqual([
      ['B', 10],
      ['A', 310],
    ])
  })

  it('sorts the slots ascending regardless of the input order', () => {
    const items = [
      { id: 'C', position: 310 },
      { id: 'A', position: 10 },
      { id: 'B', position: 100 },
    ]
    expect(preservePositionValues(items).map((i) => [i.id, i.position])).toEqual([
      ['C', 10],
      ['A', 100],
      ['B', 310],
    ])
  })

  it('keeps a row already sitting in its slot reference-equal and never mutates the input', () => {
    const a = { id: 'A', position: 10 } // already in slot 0 → must not be cloned
    const c = { id: 'C', position: 310 }
    const b = { id: 'B', position: 100 }
    const items = [a, c, b]
    const result = preservePositionValues(items)
    expect(result[0]).toBe(a)
    expect(result[1]).not.toBe(c) // reassigned 310 → 100, so cloned
    expect(result[2]).not.toBe(b)
    expect(c.position).toBe(310) // input objects untouched
    expect(b.position).toBe(100)
    expect(result).not.toBe(items)
    expect(result.map((i) => i.position)).toEqual([10, 100, 310])
  })

  it('supports a custom positionField', () => {
    const items = [
      { id: 'B', order: 310 },
      { id: 'A', order: 10 },
    ]
    const result = preservePositionValues(items, { positionField: 'order' })
    expect(result.map((i) => [i.id, i.order])).toEqual([
      ['B', 10],
      ['A', 310],
    ])
  })

  it('warns and leaves positions UNTOUCHED when a position is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = [{ id: 'B', position: 310 }, { id: 'A' }] as Array<{
      id: string
      position?: number
    }>
    const result = preservePositionValues(items)
    expect(result).toBe(items) // the SAME array back — no invented values
    expect(items.map((i) => i.position)).toEqual([310, undefined])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('leaving positions untouched')
  })

  it('warns and leaves positions UNTOUCHED when a position is non-finite', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = [
      { id: 'A', position: Number.NaN },
      { id: 'B', position: 10 },
    ]
    const result = preservePositionValues(items)
    expect(result).toBe(items)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('leaving positions untouched')
  })

  it('names the custom positionField in the warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    preservePositionValues([{ id: 'A', order: undefined }] as Array<{
      id: string
      order?: number
    }>, { positionField: 'order' })
    expect(String(warn.mock.calls[0][0])).toContain('`order`')
  })

  it('warns about DUPLICATE positions but still reassigns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = [
      { id: 'A', position: 10 },
      { id: 'B', position: 10 },
    ]
    const result = preservePositionValues(items)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('DUPLICATE')
    expect(result.map((i) => i.position)).toEqual([10, 10]) // still assigns the (duplicate) slots
  })

  it('does not warn on the happy path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    preservePositionValues([
      { id: 'B', position: 310 },
      { id: 'A', position: 10 },
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('handles an empty list without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(preservePositionValues([])).toEqual([])
    expect(warn).not.toHaveBeenCalled()
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

describe('sortByPositionDeep', () => {
  it('sorts the top level and recurses into the named child arrays', () => {
    const tree = [
      {
        id: 2,
        position: 2,
        answers: [
          { id: 'b', position: 2 },
          { id: 'a', position: 1 },
        ],
      },
      {
        id: 1,
        position: 1,
        answers: [
          { id: 'd', position: 2 },
          { id: 'c', position: 1 },
        ],
      },
    ]
    const result = sortByPositionDeep(tree, ['answers'])
    expect(result.map((q) => q.id)).toEqual([1, 2])
    expect(result[0].answers.map((a) => a.id)).toEqual(['c', 'd'])
    expect(result[1].answers.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('applies the same childKeys union at every depth, skipping keys absent on a node', () => {
    const box = [
      {
        id: 1,
        position: 1,
        contentItems: [
          { id: 'ci2', position: 2, boxPositionIncludes: [] },
          {
            id: 'ci1',
            position: 1,
            boxPositionIncludes: [
              { id: 'p2', position: 2 },
              { id: 'p1', position: 1 },
            ],
          },
        ],
      },
    ]
    const result = sortByPositionDeep(box, ['contentItems', 'boxPositionIncludes'])
    expect(result[0].contentItems.map((c) => c.id)).toEqual(['ci1', 'ci2'])
    expect(result[0].contentItems[0].boxPositionIncludes.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('does not mutate input and keeps leaf / childless nodes reference-equal', () => {
    const leaf = { id: 1, position: 2 }
    const parent = {
      id: 2,
      position: 1,
      items: [
        { id: 'y', position: 2 },
        { id: 'x', position: 1 },
      ],
    }
    const input = [leaf, parent]
    const result = sortByPositionDeep(input, ['items'])
    expect(result.map((i) => i.id)).toEqual([2, 1])
    expect(result.find((i) => i.id === 1)).toBe(leaf) // childless node: same ref
    expect(result.find((i) => i.id === 2)).not.toBe(parent) // cloned because its child array was sorted
    expect(parent.items.map((i) => i.id)).toEqual(['y', 'x']) // original nested array untouched
  })

  it('is idempotent and falls back to a flat sort with no childKeys', () => {
    const items = [
      { id: 1, position: 3 },
      { id: 2, position: 1 },
      { id: 3, position: 2 },
    ]
    const once = sortByPositionDeep(items)
    expect(once.map((i) => i.id)).toEqual([2, 3, 1])
    expect(sortByPositionDeep(once).map((i) => i.id)).toEqual([2, 3, 1])
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
