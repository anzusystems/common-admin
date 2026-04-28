import { computed, watch, type ComputedRef, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

const setsEqual = (
  a: Set<ListEditorKey>,
  b: Set<ListEditorKey>,
): boolean => a.size === b.size && [...a].every((k) => b.has(k))

export interface UseUnsavedKeysSyncOptions {
  /** v-model-bound external Set (consumer's `defineModel<Set<ListEditorKey>>('unsavedKeys', …)`). */
  unsavedKeysModel: Ref<Set<ListEditorKey>>
  /** Internal source of truth — typically a computed deriving `dirty || moved` per row. */
  internalUnsavedKeys: ComputedRef<Set<ListEditorKey>>
  /**
   * Called when the consumer clears every unsaved key externally
   * (`unsavedKeys.value = new Set()` after a successful parent-form save).
   * Editor variants typically re-capture the dirty baseline here.
   */
  onClearAll: () => void
  /**
   * Called per-key when the consumer rebases just one row (e.g. dropped a
   * specific key from the unsaved set). Editor variants typically
   * re-baseline that key only.
   */
  onClearKey: (key: ListEditorKey) => void
}

export interface UseUnsavedKeysSyncApi {
  hasUnsavedChanges: ComputedRef<boolean>
  unsavedCount: ComputedRef<number>
  /**
   * Imperative API exposed via `defineExpose` — callers pass a key to clear
   * just that row, omit it to clear everything (mirrors the model-driven
   * paths).
   */
  clearUnsavedState: (key?: ListEditorKey) => void
}

/**
 * Two-way sync between an editor's own per-row dirty/moved state and the
 * external `v-model:unsaved-keys` Set the consumer passes in.
 *
 * Internal → external: when `internalUnsavedKeys` changes, write a fresh
 * Set into the model (skipping no-op writes).
 *
 * External → internal: when the consumer overwrites the model (typically
 * to clear it after a successful save), call `onClearAll` (full clear) or
 * `onClearKey` (per-key) so the editor's dirty baseline catches up.
 *
 * The `suppressNext` flag keeps the watcher pair from ping-ponging when
 * the internal change is what triggered the model write.
 *
 * Used by `AListEditor`, `ASortableListEditor`, `ANestedSortableListEditor`.
 */
export function useUnsavedKeysSync(
  options: UseUnsavedKeysSyncOptions,
): UseUnsavedKeysSyncApi {
  let suppressNextModelWatch = false

  watch(
    options.internalUnsavedKeys,
    (now) => {
      if (setsEqual(options.unsavedKeysModel.value, now)) return
      suppressNextModelWatch = true
      options.unsavedKeysModel.value = new Set(now)
    },
    { immediate: true },
  )

  watch(options.unsavedKeysModel, (now) => {
    if (suppressNextModelWatch) {
      suppressNextModelWatch = false
      return
    }
    if (now.size === 0 && options.internalUnsavedKeys.value.size > 0) {
      options.onClearAll()
    } else {
      // Selective per-key clear: rebaseline keys present in internal but
      // absent in model.
      for (const key of options.internalUnsavedKeys.value) {
        if (!now.has(key)) options.onClearKey(key)
      }
    }
  })

  const hasUnsavedChanges = computed<boolean>(
    () => options.internalUnsavedKeys.value.size > 0,
  )
  const unsavedCount = computed<number>(
    () => options.internalUnsavedKeys.value.size,
  )

  const clearUnsavedState = (key?: ListEditorKey) => {
    if (key === undefined) {
      options.onClearAll()
    } else {
      options.onClearKey(key)
    }
  }

  return { hasUnsavedChanges, unsavedCount, clearUnsavedState }
}
