import type {
  NavigationFailure,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecordName,
  RouteRecordNameGeneric,
  Router,
} from 'vue-router'
import { readonly, type Ref, ref } from 'vue'

/** A visited route, as far as going back to it needs. */
export interface RouteHistoryEntry {
  name: RouteRecordNameGeneric
  fullPath: string
}

// Module state, so the history is one list per document. A test that fills it has to clear it
// again (`clearHistory`), or the next test in the file reads what the previous one left behind.
const history = ref<RouteHistoryEntry[]>([])
// Bumped by `clearHistory`, so that a Close landing after it leaves the new list alone.
let historyGeneration = 0
// Paths a record page left because its record failed, with when; read by `useRecordPage`, which
// skips them as a destination for a while. Here so that `clearHistory` clears it with the history.
const leftAfterFailure = new Map<string, number>()
const LEFT_AFTER_FAILURE_MS = 60_000

/** For `useRecordPage` only. */
export const markLeftAfterFailure = (path: string) => {
  const now = Date.now()
  // Expired ones go here too: a path is otherwise only dropped when it is looked up again.
  for (const [left, at] of leftAfterFailure) if (now - at >= LEFT_AFTER_FAILURE_MS) leftAfterFailure.delete(left)
  leftAfterFailure.set(path, now)
}

/** For `useRecordPage` only: the page is there again, so a failure before no longer counts. */
export const forgetLeftAfterFailure = (path: string) => {
  leftAfterFailure.delete(path)
}

/** For `useRecordPage` only. */
export const isLeftAfterFailureRecently = (path: string) => {
  const at = leftAfterFailure.get(path)
  if (at === undefined) return false
  if (Date.now() - at < LEFT_AFTER_FAILURE_MS) return true
  leftAfterFailure.delete(path)
  return false
}
const blacklistedRouteNames = ref<RouteRecordName[]>([])
/**
 * How many routes back the history reaches. Note that `addRoute` drops only CONSECUTIVE duplicates,
 * so a user bouncing A -> B -> A -> B fills four of these slots and can push the listing they want
 * to return to out of the window. `fallbackRouteName` is what catches that.
 */
const MAX_HISTORY = 10

/** Where `navigateBack` goes and its navigation, as `router.push` answers it. */
export interface NavigateBackTarget {
  to: RouteLocationRaw
  navigation: Promise<NavigationFailure | void | undefined>
}

export interface NavigateBackOptions {
  /**
   * Route names that are not a destination -- typically the sibling views of the record being
   * closed and the create form it may have been reached from. The CURRENT route is always skipped
   * on top of these, so there is no need to name it here.
   */
  skipRouteNames?: RouteRecordName[]
  /** Where to go when the walk finds nothing -- a tab opened straight on the record. */
  fallbackRouteName?: RouteRecordName
  fallbackRouteParams?: Record<string, any>
}

export function useRouteHistory(): {
  history: Readonly<Ref<readonly RouteHistoryEntry[]>>
  addRoute: (route: RouteLocationNormalized) => void
  clearHistory: () => void
  // The admin's typed router narrows `RouteRecordName` to its route names: a misspelled one does not compile.
  setBlacklistedRoutes: (routeNames: RouteRecordName[]) => void
  addBlacklistedRoute: (routeName: RouteRecordName) => void
  /** Returns where it goes and its navigation, `undefined` for a step back in the browser's history. */
  navigateBack: (router: Router, options?: NavigateBackOptions) => NavigateBackTarget | undefined
} {
  const addRoute = (route: RouteLocationNormalized) => {
    if (blacklistedRouteNames.value.includes(route.name as RouteRecordName)) {
      return
    }

    // A list filter rewrites its hash with `history.replaceState`, which the router never sees. On a
    // push the address bar still shows the route being left, so its hash is the one to come back to.
    const [pathAndQuery] = route.fullPath.split('#')
    if (pathAndQuery === window.location.pathname + window.location.search && route.hash !== window.location.hash) {
      route = { ...route, hash: window.location.hash, fullPath: pathAndQuery + window.location.hash }
    }

    const lastRoute = history.value[history.value.length - 1]
    if (lastRoute && lastRoute.fullPath === route.fullPath) {
      return
    }

    history.value.push({ name: route.name, fullPath: route.fullPath })
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
  }

  /** REPLACES the list. Two callers would overwrite each other -- to add one, use `addBlacklistedRoute`. */
  const setBlacklistedRoutes = (routeNames: RouteRecordName[]) => {
    blacklistedRouteNames.value = routeNames
  }

  const addBlacklistedRoute = (routeName: RouteRecordName) => {
    if (!blacklistedRouteNames.value.includes(routeName)) {
      blacklistedRouteNames.value.push(routeName)
    }
  }

  // Internal on purpose. A caller reaching for it directly would get the walk WITHOUT the
  // current-route exclusion `navigateBack` adds -- which is the whole trap `navigateBack` exists
  // to close.
  const findRouteBack = (isDestination: (route: RouteHistoryEntry) => boolean): RouteHistoryEntry | undefined => {
    for (let i = history.value.length - 1; i >= 0; i--) {
      if (isDestination(history.value[i]!)) {
        return history.value[i]
      }
    }
    return undefined
  }

  const clearHistory = () => {
    history.value = []
    historyGeneration++
    leftAfterFailure.clear()
  }

  const navigateBack = (router: Router, options: NavigateBackOptions = {}): NavigateBackTarget | undefined => {
    const { skipRouteNames, fallbackRouteName, fallbackRouteParams } = options
    const current = router.currentRoute.value
    const skip: readonly RouteRecordNameGeneric[] = skipRouteNames ?? []

    // The route we are on is never a place to go back to. `addRoute` runs in `beforeEach`, so a
    // navigation that a later guard cancels still records the route we never left -- and pushing
    // that again is a silent no-op, which reads as the button doing nothing at all. Callers
    // therefore do not name their own route in `skipRouteNames`.
    //
    // Both tests sit INSIDE the walk rather than filtering its result: a route name is optional in
    // vue-router, and a nameless current route can only be recognised by its path -- rejecting the
    // candidate afterwards would stop the walk at it instead of carrying on to the entry before.
    // Names are compared with `===` so a symbol name counts too, but only when the current route
    // has one: two different nameless routes are both `undefined` and are not the same place.
    const isCurrent = (route: RouteHistoryEntry) =>
      route.fullPath === current.fullPath || (current.name !== undefined && route.name === current.name)

    const route = findRouteBack((entry) => !isCurrent(entry) && !skip.includes(entry.name))

    if (route) {
      const generation = historyGeneration
      const navigation = router.push(route.fullPath)
      // Back on `route`, what came after it is behind the user, the route being left included, which
      // this navigation's `beforeEach` records. Kept, it is the next Close's destination: detail A, a
      // link to detail B, Close to A, and Close on A went back to B, over and over. Dropped once the
      // navigation has landed, so one that a guard stops (unsaved changes) or a second click cancels
      // leaves the history as it was. `Promise.resolve`: a test double's `push` may answer nothing.
      Promise.resolve(navigation).then(
        (failure) => {
          if (failure || generation !== historyGeneration) return
          // Gone without `clearHistory`, `route` was pushed out at the front (`MAX_HISTORY`) by the
          // route being left: all that is still here came after it.
          const at = history.value.indexOf(route)
          history.value.splice(at === -1 ? 0 : at)
        },
        () => undefined
      )
      return { to: route.fullPath, navigation }
    }
    if (fallbackRouteName) {
      const fallback = { name: fallbackRouteName, params: fallbackRouteParams }
      return { to: fallback, navigation: router.push(fallback) }
    }
    router.back()
    return undefined
  }

  return {
    history: readonly(history),
    addRoute,
    clearHistory,
    setBlacklistedRoutes,
    addBlacklistedRoute,
    navigateBack,
  }
}
