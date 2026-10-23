import type { Ref } from 'vue'
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
