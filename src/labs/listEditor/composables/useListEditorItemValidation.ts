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

export interface UseListEditorItemValidationOptions {
  /**
   * Stable identity of the row in the editor's v-model. Pass a getter so the
   * composable can re-register if the key ever swaps.
   */
  key: () => ListEditorKey
  /**
   * Reactive validation state. Common shape: a computed reading vuelidate's
   * `v$.$dirty && v$.$invalid` and returning 'invalid' or null.
   */
  state:
    | Ref<ListEditorValidationState>
    | ComputedRef<ListEditorValidationState>
    | (() => ListEditorValidationState)
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

  const stateRef = computed<ListEditorValidationState>(() => {
    const s = options.state
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
