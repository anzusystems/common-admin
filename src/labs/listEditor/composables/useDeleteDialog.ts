import { ref, type Ref } from 'vue'

export interface UseDeleteDialogOptions<TItem, ViewItem> {
  /**
   * Confirm hook — called before any destructive work. Returning `false`
   * aborts the delete silently; rejecting is treated the same as the caller's
   * `onDelete` rejecting (error message surfaced in the dialog).
   */
  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  /**
   * Destructive work hook — consumer-side deletion (e.g. API call). If it
   * throws, the error is surfaced in the dialog and the local state is not
   * mutated.
   */
  onDelete?: (item: TItem) => Promise<void> | void
  /**
   * Called once the delete has succeeded end-to-end. The consumer performs
   * the editor mutation + clears component-local state here (editingKeys,
   * editingSnapshots, expanded flags, etc.). Keeping this step outside the
   * composable is deliberate — it lets each editor variant own its
   * per-component state shape without leaking it into the shared code.
   */
  onDeleted: (item: ViewItem) => void
  /**
   * Runs at click time. When true, the confirmation dialog is skipped and
   * delete proceeds immediately. Lets callers bypass the dialog for
   * specific modes (e.g. chips) without threading a prop through.
   */
  disableDeleteConfirm: () => boolean
}

export interface UseDeleteDialogApi<TItem, ViewItem> {
  deleteDialog: Ref<boolean>
  deleteTarget: Ref<ViewItem | null>
  deleteInFlight: Ref<boolean>
  deleteError: Ref<string | null>
  performDelete: (vi: ViewItem) => Promise<boolean>
  onDeleteClick: (vi: ViewItem) => Promise<void>
  onDeleteDialogConfirm: () => Promise<void>
  onDeleteDialogCancel: () => void
}

/**
 * Delete-flow state + handlers shared across list-editor variants. Owns the
 * dialog boolean, the target row, the in-flight flag and the error string;
 * dispatches to the caller's confirm/delete/deleted hooks in the right order.
 *
 * Pure behaviour — no template, no editor dependency. The dialog markup
 * stays in each component (it references component-local slots and refs).
 */
export function useDeleteDialog<
  TItem extends Record<string, any>,
  ViewItem extends { key: string | number; raw: TItem },
>(
  options: UseDeleteDialogOptions<TItem, ViewItem>,
): UseDeleteDialogApi<TItem, ViewItem> {
  const deleteDialog = ref(false)
  const deleteTarget = ref<ViewItem | null>(null) as Ref<ViewItem | null>
  const deleteInFlight = ref(false)
  const deleteError = ref<string | null>(null)

  const performDelete = async (vi: ViewItem): Promise<boolean> => {
    deleteError.value = null
    if (options.onDeleteConfirm) {
      const ok = await options.onDeleteConfirm(vi.raw)
      if (!ok) return false
    }
    if (options.onDelete) {
      deleteInFlight.value = true
      try {
        await options.onDelete(vi.raw)
      } catch (err) {
        deleteInFlight.value = false
        deleteError.value = err instanceof Error ? err.message : String(err)
        return false
      }
      deleteInFlight.value = false
    }
    options.onDeleted(vi)
    return true
  }

  const onDeleteClick = async (vi: ViewItem) => {
    if (options.disableDeleteConfirm()) {
      await performDelete(vi)
      return
    }
    deleteTarget.value = vi
    deleteError.value = null
    deleteDialog.value = true
  }

  const onDeleteDialogConfirm = async () => {
    if (!deleteTarget.value) return
    const ok = await performDelete(deleteTarget.value as ViewItem)
    if (ok) {
      deleteDialog.value = false
      deleteTarget.value = null
    }
  }

  const onDeleteDialogCancel = () => {
    if (deleteInFlight.value) return
    deleteDialog.value = false
    deleteTarget.value = null
    deleteError.value = null
  }

  return {
    deleteDialog,
    deleteTarget,
    deleteInFlight,
    deleteError,
    performDelete,
    onDeleteClick,
    onDeleteDialogConfirm,
    onDeleteDialogCancel,
  }
}
