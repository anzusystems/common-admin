import { isNavigationFailure, NavigationFailureType, type RouteLocationRaw, type Router, useRouter } from 'vue-router'

interface NavigationState {
  pending: boolean
  pageId: number
}

const states = new WeakMap<Router, NavigationState>()
let appRouter: Router | undefined

/**
 * Follows the user's navigation on `router`: whether one is on its way, and which page is shown.
 *
 * Register it as the router's first guard. A page that acts after an asynchronous step -- a load, a save, a socket
 * event -- asks `onPage()` first (`usePageNavigation`): while the user is navigating, or once the user has left, it
 * does nothing. Its redirect would cancel the user's navigation (in production a page's chunk is fetched on its first
 * visit), and its message would stay on the page the user went to.
 *
 * Returns the unregistration, for tests that create a router each.
 */
export function trackNavigation(router: Router): () => void {
  appRouter = router
  if (states.has(router)) return () => undefined
  const state: NavigationState = { pending: false, pageId: 0 }
  states.set(router, state)
  const removeBeforeEach = router.beforeEach(() => {
    state.pending = true
  })
  const removeAfterEach = router.afterEach((to, from, failure) => {
    // A newer navigation took its place and is still on its way; it clears the flag itself.
    if (isNavigationFailure(failure, NavigationFailureType.cancelled)) return
    state.pending = false
    // The admins key their RouterView by the path: another path is another page.
    if (!failure && to.path !== from.path) state.pageId += 1
  })
  const removeOnError = router.onError(() => {
    state.pending = false
  })
  return () => {
    removeBeforeEach()
    removeAfterEach()
    removeOnError()
    states.delete(router)
    if (appRouter === router) appRouter = undefined
  }
}

export const isNavigationPending = (router: Router): boolean => states.get(router)?.pending === true

/** Whether the app's router has a navigation of the user's on its way. */
export const isAppNavigationPending = (): boolean => appRouter !== undefined && isNavigationPending(appRouter)

const pageIdOf = (router: Router) => states.get(router)?.pageId ?? 0

export interface UsePageNavigationReturn {
  /** The user is still on this page and not navigating away from it. */
  onPage: () => boolean
  /** Navigates only `onPage()`. Resolves whether it got there. */
  push: (to: RouteLocationRaw) => Promise<boolean>
  replace: (to: RouteLocationRaw) => Promise<boolean>
}

/**
 * For a page, or a composable it calls in its setup, that navigates after an asynchronous step: the redirect after a
 * save, a create or a delete, a load that forwards. The page is the one shown at setup; a later instance of the same
 * path (A, B, A again) is another page. A composable that is handed its router passes it on.
 */
export function usePageNavigation(router: Router | undefined = useRouter()): UsePageNavigationReturn {
  // Without a router (a composable mounted alone in a test) there is nothing to follow, and nothing to navigate.
  if (!router) return { onPage: () => true, push: async () => false, replace: async () => false }
  // Registered late if the admin did not register it: it then misses only the guards that run before it.
  trackNavigation(router)
  const pageId = pageIdOf(router)

  const onPage = () => !isNavigationPending(router) && pageIdOf(router) === pageId

  // Not async: a location the router refuses to resolve still throws where the caller's try/catch sees it.
  const navigate = (to: RouteLocationRaw, replace: boolean): Promise<boolean> => {
    if (!onPage()) return Promise.resolve(false)
    return (replace ? router.replace(to) : router.push(to)).then((failure) => !failure)
  }

  return {
    onPage,
    push: (to) => navigate(to, false),
    replace: (to) => navigate(to, true),
  }
}
