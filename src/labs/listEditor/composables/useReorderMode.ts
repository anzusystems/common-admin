import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export type ReorderModeValue = 'view' | 'reorder'

export interface UseReorderModeEmit<T> {
  reorderStart: () => void
  reorderCancel: () => void
  reorderApplied: (payload: T) => void
  reorderApplyError: (err: unknown) => void
  reorderEnd: () => void
}

export interface UseReorderModeOptions<T> {
  /**
   * v-model-backed mode ref — the composable reads + writes, but the
   * component owns the `defineModel('mode', ...)` so external
   * `v-model:mode` bindings still flow. Passing the ref in avoids
   * duplicating the defineModel contract inside the composable.
   */
  mode: Ref<ReorderModeValue>
  /**
   * Reorder snapshot — cloned on enter, restored on cancel, cleared on
   * apply. Stays at component level (the dirty-baseline needs to read it
   * indirectly too), but the composable owns every assignment.
   */
  snapshot: Ref<T | null>
  /**
   * Keys the user has actively moved this session (drag, arrow buttons,
   * indent/outdent). Cleared on every mode transition. Stays at component
   * level because the per-row decorator reads it for the `moved` flag.
   */
  movedKeys: Ref<Set<ListEditorKey>>
  modelValue: Ref<T>
  /**
   * Deep-clone the model value for snapshotting. Caller-provided because
   * the nested tree shape and flat array shape need different serializer
   * handling (both use `cloneDeep` in practice, but the callsite already
   * imports it).
   */
  cloneModel: (m: T) => T
  applyModel: (m: T) => void
  canEnterReorder: ComputedRef<boolean>
  /**
   * Hook run after mode flips to `reorder` but before emit — nested uses
   * this to expand every branch + init sortable instances, flat uses it
   * (via nothing — the sortable initialises lazily via a watch in the
   * flat variant). Left optional.
   */
  onEnter?: () => void
  /**
   * Hook run after mode flips back to `view` on cancel — nested destroys
   * its sortable instances here. Flat doesn't need it.
   */
  onCancel?: () => void
  /**
   * Hook run after apply succeeds — nested destroys its sortable instances
   * here. Flat doesn't need it.
   */
  onApplyEnd?: () => void
  /**
   * Called from the mode watcher when mode flips externally from `view` to
   * `reorder` (e.g. v-model:mode bound by the parent) — each variant uses
   * this to clear variant-specific caches that `enterReorderMode` itself
   * also clears via its own call-site. The flat variant clears editing +
   * expanded; nested clears editing only (children-expanded stays).
   */
  onExternalEnter?: () => void
  /**
   * Async persist callback wired from the parent — identical semantics to
   * the old `props.onReorderApply`. Receives the cloned payload (array for
   * flat, tree for nested); throwing surfaces the error in the header
   * toolbar via `applyError`.
   */
  onReorderApply?: (payload: T) => Promise<void> | void
  /**
   * Optional override for the payload passed to `onReorderApply` + the
   * `reorder-applied` emit — defaults to `cloneModel(modelValue)`. Exists
   * so consumers could send a different shape than their stored snapshot
   * if the need arises; both current callers use the default.
   */
  clonePayload?: (m: T) => T
  /**
   * Embedded mode — the editor follows external mode changes but does NOT
   * own a snapshot or apply/cancel logic. The parent (a non-embedded outer
   * editor) takes a deep snapshot covering this editor's data too, so cancel
   * at the top restores everything. Used for the "shared reorder" pattern
   * where a single Reorder button drives multiple stacked editors.
   */
  embedded?: ComputedRef<boolean> | Ref<boolean>
  emit: UseReorderModeEmit<T>
}

export interface UseReorderModeApi {
  applying: Ref<boolean>
  applyError: Ref<string | null>
  hasPendingChanges: ComputedRef<boolean>
  movedCount: ComputedRef<number>
  reorderMode: ComputedRef<boolean>
  enterReorderMode: () => void
  cancelReorderMode: () => void
  applyReorder: () => Promise<void>
}

/**
 * Reorder-mode state machine shared between ASortableListEditor and
 * ANestedSortableListEditor. Owns the `applying` + `applyError` flags, the
 * pending-changes counters, and the enter / cancel / apply transitions —
 * plus the mode watcher that fires when the v-model:mode flips externally.
 *
 * The snapshot and `movedKeys` sets stay at component level because the
 * per-row decorator + dirty-baseline read them directly; the composable
 * takes them as refs so it can still drive the state machine.
 */
export function useReorderMode<T>(
  options: UseReorderModeOptions<T>,
): UseReorderModeApi {
  const applying = ref(false)
  const applyError = ref<string | null>(null)

  const reorderMode = computed(() => options.mode.value === 'reorder')
  const movedCount = computed(() => options.movedKeys.value.size)
  const hasPendingChanges = computed(() => movedCount.value > 0)

  const clonePayload = (): T =>
    options.clonePayload
      ? options.clonePayload(options.modelValue.value)
      : options.cloneModel(options.modelValue.value)

  const isEmbedded = (): boolean => options.embedded?.value === true

  const enterReorderMode = () => {
    if (!options.canEnterReorder.value || reorderMode.value) return
    if (!isEmbedded()) {
      options.snapshot.value = options.cloneModel(options.modelValue.value)
    }
    options.movedKeys.value = new Set()
    applyError.value = null
    options.mode.value = 'reorder'
    options.onEnter?.()
    options.emit.reorderStart()
  }

  const cancelReorderMode = () => {
    if (!reorderMode.value) return
    if (!isEmbedded() && options.snapshot.value) {
      options.applyModel(options.snapshot.value as T)
    }
    options.snapshot.value = null
    options.movedKeys.value = new Set()
    applyError.value = null
    applying.value = false
    options.mode.value = 'view'
    options.onCancel?.()
    options.emit.reorderCancel()
    options.emit.reorderEnd()
  }

  const applyReorder = async () => {
    if (!reorderMode.value) return
    const payload = clonePayload()
    applyError.value = null
    if (!isEmbedded() && options.onReorderApply) {
      applying.value = true
      try {
        await options.onReorderApply(payload)
      } catch (err) {
        applying.value = false
        applyError.value = err instanceof Error ? err.message : String(err)
        options.emit.reorderApplyError(err)
        return
      }
      applying.value = false
    }
    // Deliberately keep `movedKeys` populated — consumer still has to persist
    // the new order via their own API call before rows are truly "saved"; we
    // let them clear the state manually via `resetDirtyBaseline` on success.
    options.snapshot.value = null
    options.mode.value = 'view'
    options.onApplyEnd?.()
    options.emit.reorderApplied(payload)
    options.emit.reorderEnd()
  }

  // Handle external mode flips (v-model:mode from a parent) — mirror the
  // same bookkeeping enterReorderMode / cancelReorderMode do so the state
  // stays consistent whether the transition came from a button click or a
  // parent binding. Embedded editors do NOT take a snapshot; their parent
  // (the outer non-embedded editor) owns one that covers nested data too.
  //
  // The view→reorder→view cleanup path differs between embedded and
  // non-embedded:
  //   - non-embedded cancel: snapshot is set → clear state here
  //   - non-embedded apply: applyReorder nulls snapshot BEFORE flipping
  //     mode, so the snapshot-guarded branch is skipped → movedKeys stays
  //     populated until consumer calls resetDirtyBaseline (the contract)
  //   - embedded: no snapshot ever, clear state on every view transition
  //     so the inner editor's movedKeys doesn't outlive a parent
  //     cancel/apply (otherwise rows would render as `unsaved` after the
  //     parent restores the original data)
  watch(options.mode, (newMode, oldMode) => {
    if (newMode === 'reorder' && oldMode !== 'reorder') {
      if (!isEmbedded() && !options.snapshot.value) {
        options.snapshot.value = options.cloneModel(options.modelValue.value)
      }
      options.movedKeys.value = new Set()
      options.onExternalEnter?.()
    }
    if (newMode === 'view' && oldMode === 'reorder') {
      if (options.snapshot.value) {
        options.snapshot.value = null
        options.movedKeys.value = new Set()
        applyError.value = null
        applying.value = false
      } else if (isEmbedded()) {
        options.movedKeys.value = new Set()
        applyError.value = null
        applying.value = false
      }
    }
  })

  return {
    applying,
    applyError,
    hasPendingChanges,
    movedCount,
    reorderMode,
    enterReorderMode,
    cancelReorderMode,
    applyReorder,
  }
}
