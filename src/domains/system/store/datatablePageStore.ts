import { ref } from 'vue'
import { isNavigationFailure, NavigationFailureType, type Router } from 'vue-router'
import type { NavigateBackTarget } from '@/domains/system/composables/routeHistory'
import { isUndefined } from '@/shared/utils/common'

// The page is remembered per table. A single global slot used to leak across entities: paging
// list B to page 5, closing any detail and then opening list A reopened A on page 5, because
// both the stored page and the preserve flag were shared. The flag stays global on purpose —
// it means "the next list I land on should restore its page" — but the page itself is keyed.
const storedPages = ref<Record<string, number>>({})
const preservePage = ref<boolean>(false)

const UNSCOPED_KEY = '__unscoped'

// One for all close buttons: a newer Close takes over the landing of an older one rather than leaving it to clear the
// flag the newer one set.
let stopPendingLanding: (() => void) | undefined

export const datatablePageKey = (system?: unknown, subject?: unknown): string =>
  typeof system === 'string' && typeof subject === 'string' ? `${system}_${subject}` : UNSCOPED_KEY

export function useDatatablePageStore() {
  const setStoredPage = (key: string, page: number) => {
    storedPages.value[key] = page
  }

  const setPreservePage = () => {
    preservePage.value = true
  }

  /**
   * The flag for the page the Close's navigation lands on, and only for it: a list there takes the page as it mounts,
   * after the landing's `afterEach`. The next navigation drops it, and so does the Close's navigation stopped, failing
   * or cancelled by another one (its own `router.push` answers that), and a landing elsewhere; a second click takes it
   * over. The navigation that cancelled the Close is one of its own, a link opening the list afresh, even to the very
   * same address; only one that lands there before the Close's cancel is reported finds the page. Without `closing` (a
   * step back in the browser's history, which answers nothing) the first landing takes it, and a failure other than a
   * cancel, or a navigation error, drops it.
   *
   * The push's rejection is handled here: an error vue-router reports goes to the app's `onError` as before, but one
   * it does not (an app's `afterEach` throwing, as for a `RouterLink`) is no longer an unhandled rejection. During a
   * step back the store listens to `onError` too, so in an app with no listener of its own vue-router no longer logs
   * that navigation's error to the console.
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
    return storedPages.value[key] ?? null
  }

  return {
    setStoredPage,
    setPreservePage,
    preservePageForLanding,
    consumeStoredPage,
  }
}
