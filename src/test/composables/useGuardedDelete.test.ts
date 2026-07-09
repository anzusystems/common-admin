import { describe, it, expect, vi } from 'vitest'
import { useGuardedDelete } from '@/labs/unsavedGuard/useGuardedDelete'

// QA 85050 batch 7 — BUG-08. An entity delete must bypass the unsaved-changes leave guard: it
// acknowledges the guard BEFORE the delete so the post-delete `router.push` navigates without the
// (now meaningless) "you have unsaved changes, really leave?" prompt.
// M1 — but a FAILED delete never navigates, so the acknowledgement must be undone or the next dirty
// navigation slips past the guard silently.

const makeGuard = () => ({ acknowledge: vi.fn(), unacknowledge: vi.fn() })

describe('useGuardedDelete', () => {
  it('acknowledges the guard BEFORE running the delete, forwarding args + return value', () => {
    const order: string[] = []
    const guard = { acknowledge: vi.fn(() => order.push('ack')), unacknowledge: vi.fn() }
    const onDelete = vi.fn((id: number) => {
      order.push(`del:${id}`)
      return `done:${id}`
    })

    const guarded = useGuardedDelete(guard, onDelete)
    const result = guarded(7)

    expect(guard.acknowledge).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(7)
    expect(order).toEqual(['ack', 'del:7']) // acknowledge strictly before the delete
    expect(result).toBe('done:7')
    expect(guard.unacknowledge).not.toHaveBeenCalled()
  })

  it('acknowledges before an async delete even begins (so a later navigation is not prompted)', async () => {
    const order: string[] = []
    const guard = { acknowledge: () => order.push('ack'), unacknowledge: () => order.push('unack') }
    const onDelete = async () => {
      order.push('delete-start')
      await Promise.resolve()
      order.push('navigate')
    }

    await useGuardedDelete(guard, onDelete)()

    expect(order).toEqual(['ack', 'delete-start', 'navigate']) // no unacknowledge on success
  })

  it('unacknowledges when an async delete REJECTS (M1 — no navigation happened) and re-throws', async () => {
    const guard = makeGuard()
    const boom = new Error('delete failed')
    const onDelete = async () => {
      throw boom
    }

    await expect(useGuardedDelete(guard, onDelete)()).rejects.toBe(boom)
    expect(guard.acknowledge).toHaveBeenCalledTimes(1)
    expect(guard.unacknowledge).toHaveBeenCalledTimes(1)
  })

  it('unacknowledges when a synchronous delete throws before navigating and re-throws', () => {
    const guard = makeGuard()
    const boom = new Error('sync delete failed')
    const onDelete = () => {
      throw boom
    }

    expect(() => useGuardedDelete(guard, onDelete)()).toThrow(boom)
    expect(guard.acknowledge).toHaveBeenCalledTimes(1)
    expect(guard.unacknowledge).toHaveBeenCalledTimes(1)
  })
})
