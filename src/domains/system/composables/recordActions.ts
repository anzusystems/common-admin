import type { Ref } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { handleRecordLoadError } from '@/domains/system/composables/recordPage'

/**
 * Get-one loader for a detail or edit page, in the shape `useRecordPage`
 * reads. Raises `loading` and runs `load` with the page's signal.
 * Returns `true` once loaded, else the result of `handleRecordLoadError`: `false`
 * leaves the page, `undefined` means aborted or session expired (page stays).
 * `loading` is lowered unless the load was aborted, because the flag then belongs to the next page.
 * A bare `return` in `load` means loaded, and anything thrown counts as a load failure.
 * Use it only for the record's single request; anything more stays hand-written.
 * @example
 * const fetchData = defineRecordLoader(detailLoading, async (id: IntegerId, signal) => {
 *   faq.value = await fetchFaq({ urlParams: { id }, signal })
 * })
 */
export const defineRecordLoader =
  <Id>(loading: Ref<boolean>, load: (id: Id, signal: AbortSignal | undefined) => Promise<void>) =>
  async (id: Id, options: { signal?: AbortSignal } = {}): Promise<boolean | undefined> => {
    loading.value = true
    try {
      await load(id, options.signal)
      return true
    } catch (error) {
      return handleRecordLoadError(error) ? false : undefined
    } finally {
      if (!options.signal?.aborted) loading.value = false
    }
  }

/**
 * Save of a create or edit form. Raises `loading`, touches `v$` and calls `showValidationError`
 * if invalid, runs `save`, shows errors with `showErrorsDefault`, lowers `loading`.
 * The success alert and what follows it stay in `save`.
 * `loading` and `v$` are captured at definition, so both must exist then. Extra validators,
 * flags, error handling, `finally` work, return values or requests stay hand-written.
 * @example
 * const onUpdate = defineRecordSave(saveButtonLoading, v$, async () => {
 *   faq.value = await updateFaq({ urlParams: { id: faq.value.id }, body: faq.value })
 *   showRecordWas('updated')
 * })
 */
export const defineRecordSave = <Args extends unknown[]>(
  loading: Ref<boolean>,
  v$: Ref<{ $touch: () => void; $invalid: boolean }>,
  save: (...args: Args) => Promise<void>
) => {
  const { showValidationError, showErrorsDefault } = useAlerts()
  return async (...args: Args): Promise<void> => {
    loading.value = true
    try {
      v$.value.$touch()
      if (v$.value.$invalid) {
        showValidationError()
        return
      }
      await save(...args)
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      loading.value = false
    }
  }
}
