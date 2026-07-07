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
 * Usage: `@delete-record="guardedDelete(() => onDelete(id))"` or wrap the handler once.
 */
export function useGuardedDelete<A extends unknown[], R>(
  guard: Pick<UseUnsavedChangesGuardApi, 'acknowledge'>,
  onDelete: (...args: A) => R,
): (...args: A) => R {
  return (...args: A): R => {
    guard.acknowledge()
    return onDelete(...args)
  }
}
