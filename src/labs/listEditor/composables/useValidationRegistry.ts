import { provide, reactive, type ComputedRef, type Ref } from 'vue'
import {
  ListEditorValidationKey,
  type ListEditorValidationRegistry,
} from '@/labs/listEditor/composables/useListEditorItemValidation'
import type {
  ListEditorKey,
  ListEditorValidationState,
} from '@/labs/listEditor/types/listEditorTypes'

const isValidState = (v: unknown): v is Exclude<ListEditorValidationState, null> =>
  v === 'valid' || v === 'invalid' || v === 'warning'

export interface UseValidationRegistryOptions<TItem extends Record<string, any>> {
  /**
   * Caller-provided fallback callback. Tried only when no descendant has
   * registered a state for the row via `useListEditorItemValidation`.
   */
  getValidationState?: (item: TItem, key: ListEditorKey, index: number) => ListEditorValidationState
}

export interface UseValidationRegistryApi<TItem extends Record<string, any>> {
  /**
   * Resolves a row's validation state by checking, in order:
   * 1. The provide/inject registry (descendants registered via `useListEditorItemValidation`)
   * 2. The `getValidationState` prop fallback
   * 3. The item's own `validationState` field
   *
   * Returns null when none of the above flagged a state.
   */
  resolveValidation: (raw: TItem, key?: ListEditorKey, index?: number) => ListEditorValidationState
}

/**
 * Sets up the per-item validation provide/inject registry shared by all 3
 * editor variants. Descendant rows can register their `'invalid'`/`'valid'`/
 * `'warning'` state via `useListEditorItemValidation`; the editor's row-render
 * priority order is registry → prop callback → item field.
 *
 * Used by `AListEditor`, `ASortableListEditor`, `ANestedSortableListEditor`.
 */
export function useValidationRegistry<TItem extends Record<string, any>>(
  options: UseValidationRegistryOptions<TItem>,
): UseValidationRegistryApi<TItem> {
  const itemValidationStates = reactive(
    new Map<
      ListEditorKey,
      Ref<ListEditorValidationState> | ComputedRef<ListEditorValidationState>
    >(),
  )

  provide<ListEditorValidationRegistry>(ListEditorValidationKey, {
    register(key, state) {
      itemValidationStates.set(key, state)
    },
    unregister(key) {
      itemValidationStates.delete(key)
    },
  })

  const resolveValidation = (
    raw: TItem,
    key?: ListEditorKey,
    index?: number,
  ): ListEditorValidationState => {
    if (key !== undefined) {
      const fromRegistry = itemValidationStates.get(key)?.value
      if (isValidState(fromRegistry)) return fromRegistry
    }
    // Fallback: a sentinel may register under the item's own id/position when the
    // editor's `key-field` resolves a different row key (e.g. a `position`-keyed
    // editor over items that also carry a temp `id`). Look the row's own ids up
    // so its state is still found. Each id is unique to the row, so this can only
    // match that same row's registration.
    if (raw) {
      const rawId = (raw as Record<string, any>).id
      if (rawId !== undefined && rawId !== null && rawId !== key) {
        const byId = itemValidationStates.get(rawId)?.value
        if (isValidState(byId)) return byId
      }
      const rawPos = (raw as Record<string, any>).position
      if (rawPos !== undefined && rawPos !== null && rawPos !== key) {
        const byPos = itemValidationStates.get(rawPos)?.value
        if (isValidState(byPos)) return byPos
      }
    }
    if (options.getValidationState && key !== undefined && index !== undefined) {
      const fromProp = options.getValidationState(raw, key, index)
      if (isValidState(fromProp)) return fromProp
    }
    const v = raw.validationState
    if (isValidState(v)) return v
    return null
  }

  return { resolveValidation }
}
