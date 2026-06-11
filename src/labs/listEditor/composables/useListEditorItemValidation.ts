import {
  computed,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import type {
  ListEditorKey,
  ListEditorValidationState,
} from '@/labs/listEditor/types/listEditorTypes'

export interface ListEditorValidationRegistry {
  register: (
    key: ListEditorKey,
    state: Ref<ListEditorValidationState> | ComputedRef<ListEditorValidationState>,
  ) => void
  unregister: (key: ListEditorKey) => void
}

export const ListEditorValidationKey = Symbol(
  'le.validation',
) as InjectionKey<ListEditorValidationRegistry>

// Editor-provided set of currently-unsaved row keys (added / modified rows).
// Consumed by `useListEditorItemValidation` so a row's `invalid` state surfaces
// as soon as the row is unsaved — vuelidate's own `$anyDirty` is relative to
// when the sentinel mounted and stays false for a freshly-added still-empty row,
// which left invalid rows showing amber instead of red. (QA Batch2 BUG-08)
export const ListEditorUnsavedKeysKey = Symbol('le.unsavedKeys') as InjectionKey<
  ComputedRef<Set<ListEditorKey>>
>

export interface UseListEditorItemValidationOptions {
  /**
   * Stable identity of the row in the editor's v-model. Pass a getter so the
   * composable can re-register if the key ever swaps.
   */
  key: () => ListEditorKey
  /**
   * Reactive validation state. Common shape: a computed reading vuelidate's
   * `v$.$dirty && v$.$invalid` and returning 'invalid' or null.
   *
   * Prefer `invalid` (+ optional `dirty`) below: it lets the editor surface the
   * error once the row is unsaved without relying on mount-relative `$anyDirty`.
   * `state` is kept for callers that report 'valid'/'warning' or custom logic.
   */
  state?:
    | Ref<ListEditorValidationState>
    | ComputedRef<ListEditorValidationState>
    | (() => ListEditorValidationState)
  /**
   * Whether the row's data fails validation right now (e.g. `() => v$.value.$invalid`).
   * When provided, the row is flagged 'invalid' as soon as it is invalid AND the
   * user has had a chance to fix it — i.e. the row is unsaved (added / modified)
   * or `dirty` below is true. Untouched rows on initial load stay clear so a
   * persisted-but-invalid record does not light up red before any interaction.
   */
  invalid?: () => boolean
  /**
   * Optional extra "has been interacted with" signal OR-ed with the editor's
   * unsaved tracking (e.g. `() => v$.value.$anyDirty`). Useful when unsaved
   * tracking is disabled on the editor.
   */
  dirty?: () => boolean
}

// Lets a row's inline form report its own validation state to the surrounding
// list editor without prop-drilling. The parent editor `provide`s the registry;
// any descendant in the slot tree can `inject` it via this composable.
//
// No-op when called outside an editor (e.g. a form re-used elsewhere) — the
// inject silently returns null.
export function useListEditorItemValidation(options: UseListEditorItemValidationOptions): void {
  const registry = inject(ListEditorValidationKey, null)
  if (!registry) return
  if (!getCurrentInstance()) return

  const unsavedKeys = inject(ListEditorUnsavedKeysKey, null)

  const stateRef = computed<ListEditorValidationState>(() => {
    if (options.invalid) {
      if (!options.invalid()) return null
      const interacted =
        (options.dirty?.() ?? false) || (unsavedKeys?.value.has(options.key()) ?? false)
      return interacted ? 'invalid' : null
    }
    const s = options.state
    if (s === undefined) return null
    if (typeof s === 'function') return s()
    return s.value
  })

  let lastKey: ListEditorKey | null = null
  watch(
    options.key,
    (now) => {
      if (lastKey !== null && lastKey !== now) registry.unregister(lastKey)
      registry.register(now, stateRef)
      lastKey = now
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (lastKey !== null) registry.unregister(lastKey)
  })
}
