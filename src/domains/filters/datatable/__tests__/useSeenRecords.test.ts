import { afterEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { useSeenRecords } from '@/domains/filters/datatable/composables/useSeenRecords'

type Row = { id: number }
const KEY = 'test_seenRecords'
const DAY_MS = 24 * 60 * 60 * 1000

const scopes: ReturnType<typeof effectScope>[] = []
const setup = () => {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useSeenRecords<Row>({ storageKey: KEY, key: (row) => row.id }))!
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  localStorage.removeItem(KEY)
})

describe('useSeenRecords', () => {
  it('counts everything of the first visit as seen, and only that', () => {
    const seen = setup()
    seen.initialize([{ id: 3 }, { id: 5 }, { id: 4 }])
    expect(seen.isSeen({ id: 5 })).toBe(true)
    expect(seen.isSeen({ id: 1 })).toBe(true)
    expect(seen.isSeen({ id: 6 })).toBe(false)
    seen.initialize([{ id: 9 }])
    expect(seen.isSeen({ id: 9 })).toBe(false)
  })

  it('remembers a seen record in the next session', () => {
    const first = setup()
    first.initialize([{ id: 1 }])
    first.markSeen([{ id: 7 }, { id: 8 }])
    const next = setup()
    expect(next.isSeen({ id: 7 })).toBe(true)
    expect(next.isSeen({ id: 8 })).toBe(true)
    expect(next.isSeen({ id: 9 })).toBe(false)
  })

  it('forgets records seen longer ago than the limit', () => {
    localStorage.setItem(KEY, JSON.stringify({ upTo: 1, seen: { 7: Date.now() - 8 * DAY_MS, 8: Date.now() - DAY_MS } }))
    const seen = setup()
    expect(seen.isSeen({ id: 7 })).toBe(false)
    expect(seen.isSeen({ id: 8 })).toBe(true)
    expect(Object.keys(JSON.parse(localStorage.getItem(KEY)!).seen)).toEqual(['8'])
  })
})
