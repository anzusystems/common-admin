import { describe, it, expect, vi } from 'vitest'
import { useGuardedDelete } from '@/labs/unsavedGuard/useGuardedDelete'

// QA 85050 batch 7 — BUG-08. An entity delete must bypass the unsaved-changes leave guard: it
// acknowledges the guard BEFORE the delete so the post-delete `router.push` navigates without the
// (now meaningless) "you have unsaved changes, really leave?" prompt.

describe('useGuardedDelete', () => {
  it('acknowledges the guard BEFORE running the delete, forwarding args + return value', () => {
    const order: string[] = []
    const guard = { acknowledge: vi.fn(() => order.push('ack')) }
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
  })

  it('acknowledges before an async delete even begins (so a later navigation is not prompted)', async () => {
    const order: string[] = []
    const guard = { acknowledge: () => order.push('ack') }
    const onDelete = async () => {
      order.push('delete-start')
      await Promise.resolve()
      order.push('navigate')
    }

    await useGuardedDelete(guard, onDelete)()

    expect(order).toEqual(['ack', 'delete-start', 'navigate'])
  })
})
