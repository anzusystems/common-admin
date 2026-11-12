import { describe, expect, it } from 'vitest'
import { syncUserAndTimeTracking } from '@/shared/utils/userAndTimeTracking'

describe('syncUserAndTimeTracking', () => {
  it('copies the four tracking fields and nothing else', () => {
    const target = {
      name: 'edited, not saved yet',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-01T00:00:00Z',
      createdBy: 1,
      modifiedBy: 1,
    }
    syncUserAndTimeTracking(target, {
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-10-02T10:00:00Z',
      createdBy: 1,
      modifiedBy: 2,
      ...({ name: 'from the server' } as object),
    })

    expect(target).toEqual({
      name: 'edited, not saved yet',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-10-02T10:00:00Z',
      createdBy: 1,
      modifiedBy: 2,
    })
  })

  it('leaves a field the answer does not carry, and writes one it sends empty', () => {
    const target: Record<string, unknown> = { createdBy: 1, modifiedBy: 1, modifiedAt: 'before' }
    syncUserAndTimeTracking(target, { modifiedAt: 'after', modifiedBy: null })

    expect(target).toEqual({ createdBy: 1, modifiedBy: null, modifiedAt: 'after' })
  })

  it('does nothing for an answer without a body', () => {
    const target = { modifiedBy: 1 }
    syncUserAndTimeTracking(target, undefined)
    syncUserAndTimeTracking(target, null)

    expect(target).toEqual({ modifiedBy: 1 })
  })
})
