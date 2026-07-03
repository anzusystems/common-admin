import { watch, type ComputedRef } from 'vue'
import useVuelidate from '@vuelidate/core'
import type { ListEditorValidationScope } from '@/labs/listEditor/types/listEditorTypes'

export interface UseListEditorScopeValidityOptions {
  /**
   * The editor's aggregate validity — the controller's `hasErrors`, a computed over ALL raw rows
   * via the `:validate` predicate (so it reflects collapsed/unmounted rows too).
   */
  hasErrors: ComputedRef<boolean>
  /**
   * The consumer's vuelidate `$scope`. `undefined` = not wired (no-op, legacy behavior);
   * `false` = explicit opt-out (the save flow calls the editor `validateAll()` itself).
   */
  validationScope: ListEditorValidationScope | false | undefined
  /**
   * Reveal every invalid row (open it + show the red rail) — pass the editor's own
   * `validateAllAndReveal` routine so nested editors also expand ancestors.
   */
  reveal: () => void
}

/**
 * Bridges the editor's aggregate row validity into the consumer's vuelidate scope collector, so a
 * plain `v$.value.$touch(); if (v$.value.$invalid) return` save gate BLOCKS (and reveals) even a
 * COLLAPSED invalid row — whose own row-form vuelidate has unmounted and deregistered.
 *
 * The editor is always mounted and `hasErrors` scans all raw rows, so the collector sees rows
 * regardless of expand state. `$invalid` reflects validity immediately (no touch needed → the save
 * blocks synchronously); the `$dirty` watch mirrors the collector's `$touch()` to open the offenders.
 *
 * Opt-in: a no-op unless `validationScope` is a real scope, so an editor without the prop behaves
 * exactly as before.
 */
export function useListEditorScopeValidity(options: UseListEditorScopeValidityOptions): void {
  const { hasErrors, validationScope, reveal } = options
  if (validationScope === undefined || validationScope === false) return

  // One editor-level child registered under the consumer's scope. The validator reads `hasErrors`
  // reactively (vuelidate's sync `$invalid` is a computed that runs it), so the collector's
  // `$invalid` tracks it. State is `hasErrors` only to give the field a (reactive) value.
  const v$ = useVuelidate(
    { listEditor: { valid: () => !hasErrors.value } },
    { listEditor: hasErrors },
    { $scope: validationScope },
  )

  // On save the consumer's collector `$touch()` propagates to this child (`$dirty` → true); mirror
  // the editor's `validateAll()` reveal so the blocked save opens WHICH rows are wrong.
  watch(
    () => v$.value.$dirty,
    (dirty) => {
      if (dirty && hasErrors.value) reveal()
    },
  )
}
