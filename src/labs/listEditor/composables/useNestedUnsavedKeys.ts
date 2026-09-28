import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface UseNestedUnsavedKeysApi {
  /** Set of unsaved keys for one parent row — used as the inner editor's `v-model:unsaved-keys`. */
  getForParent: (parentKey: ListEditorKey) => Set<ListEditorKey>
  /** Push a child editor's unsaved-key set up under `parentKey`. */
  setForParent: (parentKey: ListEditorKey, set: Set<ListEditorKey>) => void
  /**
   * Aggregated set with prefix-merged keys (`${parentKey}:${childKey}`) so two
   * different parents can't collide on a shared child key (typical for newly
   * created rows whose `id` is `0` until the API assigns one).
   */
  merged: ComputedRef<Set<ListEditorKey>>
  /** Total count across all parents — handy for the parent v-model:unsaved-keys. */
  count: ComputedRef<number>
}

/**
 * Aggregates per-parent child-editor unsaved-keys into one prefix-merged set.
 * Used by stacked editors (e.g. quiz: questions → answers) so the outer
 * editor's parent gets a single merged `Set<ListEditorKey>` to thread into a
 * unsaved-changes guard, without losing per-parent identity.
 *
 * Key collision matters: a brand-new question and a brand-new answer both
 * have `id: 0` from the factory; without the prefix the answers from two
 * different questions would dedupe into one entry and the count would
 * under-report. Prefix `${parentKey}:${childKey}` keeps them distinct.
 *
 * Usage:
 *   const childSets = useNestedUnsavedKeys()
 *   <ChildEditor
 *     :unsaved-keys="childSets.getForParent(parent.id)"
 *     @update:unsaved-keys="(s) => childSets.setForParent(parent.id, s)"
 *   />
 *   // emit `childSets.merged.value` upward
 *
 * IMPORTANT: when the parent editor uses `manage-delete`, clear the removed
 * parent's entry on its `@deleted` — `setForParent(deletedKey, new Set())` —
 * otherwise the deleted row's stale child-unsaved keys keep `merged` non-empty
 * and the unsaved-changes guard lingers after an add-then-delete.
 */
export function useNestedUnsavedKeys(): UseNestedUnsavedKeysApi {
  const byParent: Ref<Map<ListEditorKey, Set<ListEditorKey>>> = ref(new Map())

  const empty = new Set<ListEditorKey>()

  const getForParent = (parentKey: ListEditorKey): Set<ListEditorKey> =>
    byParent.value.get(parentKey) ?? empty

  const setForParent = (parentKey: ListEditorKey, set: Set<ListEditorKey>) => {
    if (set.size === 0) {
      byParent.value.delete(parentKey)
    } else {
      byParent.value.set(parentKey, set)
    }
    // Trigger reactivity for `merged` — Map mutations are tracked in Vue 3,
    // but we want a defensive re-emit by reassigning on every call so
    // consumers using shallow equality see a new identity.
    byParent.value = new Map(byParent.value)
  }

  const merged = computed<Set<ListEditorKey>>(() => {
    const out = new Set<ListEditorKey>()
    for (const [parentKey, set] of byParent.value.entries()) {
      for (const childKey of set) {
        out.add(`${String(parentKey)}:${String(childKey)}`)
      }
    }
    return out
  })

  const count = computed<number>(() => merged.value.size)

  return { getForParent, setForParent, merged, count }
}
