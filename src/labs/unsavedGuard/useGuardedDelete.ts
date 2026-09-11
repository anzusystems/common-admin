import type { UseUnsavedChangesGuardApi } from '@/labs/unsavedGuard/useUnsavedChangesGuard'

/**
 * Wrap an entity-delete handler so it bypasses the unsaved-changes leave guard.
 *
 * An entity delete destroys the record together with any unsaved edits, so the "you have unsaved
 * changes — really leave?" prompt that the delete's `router.push` would otherwise trigger is
 * meaningless: the user already confirmed the delete, and there is nothing left to keep. Without this
 * the delete runs, then the leave-guard fires on the post-delete navigation and choosing "stay" leaves
 * the view on an already-deleted entity (system error). This acknowledges the guard right before the
 * delete so the follow-up navigation proceeds without prompting. (QA 85050 batch 7 — BUG-08)
 *
 * If `onDelete` REJECTS (the delete failed and never navigated), the acknowledgement is undone
 * immediately (`unacknowledge()`) so a subsequently-dirtied navigation is still guarded (M1) — the
 * error is re-thrown so the caller's own handling runs. For this to catch failures, `onDelete` must
 * let its error propagate (don't swallow it in the action's try/catch).
 *
 * Usage: `@delete-record="guardedDelete(() => onDelete(id))"` or wrap the handler once.
 */
export function useGuardedDelete<A extends unknown[], R>(
  guard: Pick<UseUnsavedChangesGuardApi, 'acknowledge' | 'unacknowledge'>,
  onDelete: (...args: A) => R,
): (...args: A) => R | Promise<Awaited<R>> {
  return (...args: A): R | Promise<Awaited<R>> => {
    guard.acknowledge()
    let result: R
    try {
      result = onDelete(...args)
    } catch (err) {
      // Synchronous throw before any navigation — disarm and re-throw.
      guard.unacknowledge()
      throw err
    }
    // Async handler: undo the acknowledgement if the delete rejects (no navigation happened).
    if (result instanceof Promise) {
      return (result as Promise<Awaited<R>>).catch((err) => {
        guard.unacknowledge()
        throw err
      })
    }
    return result
  }
}
