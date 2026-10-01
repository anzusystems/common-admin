import { ref } from 'vue'
import {
  isNavigationFailure,
  NavigationFailureType,
  type RouteLocationNormalized,
  type RouteLocationRaw,
  type Router,
} from 'vue-router'
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
   * The flag for the page the navigation just started to `to` lands on, and only for it: a list there takes the page
   * as it mounts, after this navigation's `afterEach`. The next navigation, a failed one or one that errors drops it,
   * so it cannot reach whichever list opens later, a filtered link included. Only a landing at `to` takes it: a second
   * click while the first Close is under way does, a link that cancelled the Close does not. Without `to` (a step back
   * in the browser's history) the first landing takes it.
   */
  const preservePageForLanding = (router: Router, to?: RouteLocationRaw) => {
    stopPendingLanding?.()
    preservePage.value = true
    let landed = false
    const target = isUndefined(to) ? undefined : router.resolve(to).fullPath
    const stop = () => {
      stopAfterEach()
      stopError()
    }
    const drop = () => {
      stop()
      if (stopPendingLanding === stop) stopPendingLanding = undefined
      preservePage.value = false
    }
    const isTheClose = (to: RouteLocationNormalized) =>
      isUndefined(target) || (to.redirectedFrom ?? to).fullPath === target
    const stopAfterEach = router.afterEach((landing, _from, failure) => {
      if (isNavigationFailure(failure, NavigationFailureType.cancelled)) return
      if (landed) return drop()
      // Before the landing, an older navigation still under way that fails is not the Close's to answer for; one that
      // lands elsewhere is.
      if (!isTheClose(landing)) return failure ? undefined : drop()
      if (failure) return drop()
      landed = true
      // Landed: the next navigation drops the flag before a list mounts; kept, the listener would also keep
      // vue-router from logging that navigation's error.
      stopError()
    })
    // While the Close is under way vue-router does not log navigation errors itself: a listener is there.
    const stopError = router.onError((_error, to) => {
      if (isTheClose(to)) drop()
    })
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
