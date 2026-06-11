import type { Ref } from 'vue'
import { useListEditorItemValidation } from '@/labs/listEditor/composables/useListEditorItemValidation'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

/**
 * Minimal surface of a vuelidate instance the sentinel reads — any
 * `useVuelidate()` return value is structurally assignable.
 */
export interface VuelidateSentinelSource {
  $invalid: boolean
  $anyDirty: boolean
}

/**
 * Registers a row's vuelidate state with the surrounding list editor so the
 * row shows the red invalid rail (invalid + unsaved/dirty) instead of amber.
 *
 * This is the one blessed shape for row validity sentinels — domain sentinels
 * call their validation composable and delegate here:
 *
 * ```ts
 * const item = computed(() => props.modelValue)
 * const { v$ } = useReviewListItemValidation(item)
 * useListEditorVuelidateSentinel(v$, () => item.value.id ?? item.value.position)
 * ```
 *
 * `key` must return the same key the editor resolves for the row
 * (its `key-field`) or the item's own id/position — the editor's validation
 * registry accepts either.
 */
export function useListEditorVuelidateSentinel(
  v$: Ref<VuelidateSentinelSource>,
  key: () => ListEditorKey,
): void {
  useListEditorItemValidation({
    key,
    invalid: () => v$.value.$invalid,
    dirty: () => v$.value.$anyDirty,
  })
}
