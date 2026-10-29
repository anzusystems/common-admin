import { ref } from 'vue'
import { isNavigationFailure, NavigationFailureType, type Router } from 'vue-router'
import type { NavigateBackTarget } from '@/domains/system/composables/routeHistory'
import { isUndefined } from '@/shared/utils/common'

// The page is stored per table. A single global slot leaked across lists, so list A reopened on the page set in list B.
// The preserve flag stays global on purpose: it means the next list landed on restores its page.
// The rows per page are kept with the page: page 3 at another page size shows other rows.
// So is the view, the serialized filter and sort the page was shown in (see `useFilterHelpers`).
export interface StoredDatatablePage {
  page: number
  rowsPerPage?: number
  view?: string
}
const storedPages = ref<Record<string, StoredDatatablePage>>({})
const preservePage = ref<boolean>(false)

const UNSCOPED_KEY = '__unscoped'

// Shared by all Close buttons. A newer Close takes over an older one's
// landing, so the older one cannot clear the flag the newer one set.
let stopPendingLanding: (() => void) | undefined

export const datatablePageKey = (system?: unknown, subject?: unknown): string =>
  typeof system === 'string' && typeof subject === 'string' ? `${system}_${subject}` : UNSCOPED_KEY

export function useDatatablePageStore() {
  // `view` undefined keeps the stored one: the pager stores a page change, which stays in the view
  // the filter helpers stored on load, submit or reset. `null` forgets it.
  const setStoredPage = (key: string, page: number, rowsPerPage?: number, view?: string | null) => {
    const stored: StoredDatatablePage = { ...storedPages.value[key], page, rowsPerPage }
    if (view === null) delete stored.view
    else if (!isUndefined(view)) stored.view = view
    storedPages.value[key] = stored
  }

  const setPreservePage = () => {
    preservePage.value = true
  }

  /**
   * Sets the flag only for the page the Close's navigation lands on.
   * A list there reads it on mount, after the landing's `afterEach`.
   * The flag is dropped by the next navigation, by the Close's navigation failing
   * or being cancelled, and by a landing elsewhere. A second click takes it over.
   * Without `closing` (browser step back, which returns nothing) the first
   * landing takes it, and a non-cancel failure or navigation error drops it.
   * The push rejection is handled here, so errors vue-router does not report (e.g. an app
   * `afterEach` throwing) are not unhandled. During a step back the store also listens to `onError`,
   * so vue-router does not log that error to the console in apps without their own listener.
   */
  const preservePageForLanding = (router: Router, closing?: NavigateBackTarget) => {
    stopPendingLanding?.()
    preservePage.value = true
    let landed = false
    let stopped = false
    const target = isUndefined(closing) ? undefined : router.resolve(closing.to).fullPath
    const stop = () => {
      stopped = true
      stopAfterEach()
      stopError?.()
    }
    const drop = () => {
      stop()
      if (stopPendingLanding === stop) stopPendingLanding = undefined
      preservePage.value = false
    }
    closing?.navigation.then(
      (failure) => {
        if (!stopped && failure) drop()
      },
      () => {
        if (!stopped) drop()
      }
    )
    const stopAfterEach = router.afterEach((landing, _from, failure) => {
      if (landed) return drop()
      if (failure) {
        // Another navigation's failure is not the Close's to answer for; the Close's own comes from its push.
        if (isUndefined(closing) && !isNavigationFailure(failure, NavigationFailureType.cancelled)) drop()
        return
      }
      if (!isUndefined(target) && (landing.redirectedFrom ?? landing).fullPath !== target) return drop()
      landed = true
      // Kept past the landing, the listener would keep vue-router from logging the next navigation's error.
      stopError?.()
    })
    const stopError = isUndefined(closing) ? router.onError(drop) : undefined
    stopPendingLanding = stop
  }

  const consumeStoredPage = (key: string): number | null => {
    if (!preservePage.value) return null
    preservePage.value = false
    return storedPages.value[key]?.page ?? null
  }

  // Read with a page `consumeStoredPage` returned, so the list shows the same rows.
  const getStoredRowsPerPage = (key: string): number | null => storedPages.value[key]?.rowsPerPage ?? null

  const getStoredView = (key: string): string | null => storedPages.value[key]?.view ?? null

  return {
    setStoredPage,
    setPreservePage,
    preservePageForLanding,
    consumeStoredPage,
    getStoredRowsPerPage,
    getStoredView,
  }
}
