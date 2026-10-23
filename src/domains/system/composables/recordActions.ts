import type { Ref } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { handleRecordLoadError } from '@/domains/system/composables/recordPage'

/**
 * The record's get-one for a detail or edit page, in the shape `useRecordPage` reads: raises `loading`, runs `load`
 * with the page's signal and answers `true` once it resolved, or what `handleRecordLoadError` says after it showed
 * why it threw: `false` leave the page, `undefined` the request was stopped or the session expired (the page stays).
 * `loading` goes down unless the load was aborted: the flag belongs to the next page by then.
 *
 * Inside `load` a bare `return` means loaded (`true`), not "stay" as in a hand-written loader, and everything thrown
 * counts as the record failing to load. So only for the record's own single request: a second awaited request, a
 * secondary request with its own error handling, an early exit meaning "stay", an own alert, an own abort check, an
 * extra loaded/ready flag or a flag kept in a store stays hand-written.
 *
 * ```ts
 * const fetchData = defineRecordLoader(detailLoading, async (id: IntegerId, signal) => {
 *   faq.value = await fetchFaq({ urlParams: { id }, signal })
 * })
 * ```
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
 * The save of a create or edit form: raises `loading`, touches `v$` and stops with `showValidationError` when it is
 * invalid, runs `save`, shows a thrown error with `showErrorsDefault`, lowers `loading`. The success alert and what
 * follows it (a callback, a route push, closing a dialog) stay in `save`.
 *
 * `loading` and `v$` are taken when the save is defined, so both must exist by then. A second validator, a check
 * before the flag goes up, a second flag, own error handling, work in `finally`, a returned value or a second
 * request stays hand-written.
 *
 * ```ts
 * const onUpdate = defineRecordSave(saveButtonLoading, v$, async () => {
 *   faq.value = await updateFaq({ urlParams: { id: faq.value.id }, body: faq.value })
 *   showRecordWas('updated')
 * })
 * ```
 */
export const defineRecordSave =
  <Args extends unknown[]>(
    loading: Ref<boolean>,
    v$: Ref<{ $touch: () => void; $invalid: boolean }>,
    save: (...args: Args) => Promise<void>
  ) =>
  async (...args: Args): Promise<void> => {
    const { showValidationError, showErrorsDefault } = useAlerts()
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
