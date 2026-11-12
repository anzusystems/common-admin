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

// Module state, so there is one history per document. A test that fills
// it must call `clearHistory`, or the next test sees the leftovers.
const history = ref<RouteHistoryEntry[]>([])
// Bumped by `clearHistory`, so a Close landing afterwards leaves the new list alone.
let historyGeneration = 0
// Paths a record page left after its record failed, with the
// time. `useRecordPage` skips them as destinations for a while.
// Kept here so `clearHistory` clears it too.
const leftAfterFailure = new Map<string, number>()
const LEFT_AFTER_FAILURE_MS = 60_000

/** For `useRecordPage` only. */
export const markLeftAfterFailure = (path: string) => {
  const now = Date.now()
  // Prunes expired entries here too. Otherwise a path is dropped only when it is looked up again.
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
 * How many routes back the history reaches. `addRoute` drops only consecutive
 * duplicates, so A, B, A, B uses four slots and can push the wanted list out.
 * `fallbackRouteName` covers that case.
 */
const MAX_HISTORY = 10

/** Where `navigateBack` goes and its navigation, as `router.push` answers it. */
export interface NavigateBackTarget {
  to: RouteLocationRaw
  navigation: Promise<NavigationFailure | void | undefined>
}

export interface NavigateBackOptions {
  /**
   * Route names that are not a destination, typically the record's sibling views and its create form.
   * The current route is always skipped, so do not list it here.
   */
  skipRouteNames?: RouteRecordName[]
  /** Where to go when the walk finds nothing, e.g. a tab opened directly on the record. */
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
  /** Returns the target and its navigation, or `undefined` for a browser history step back. */
  navigateBack: (router: Router, options?: NavigateBackOptions) => NavigateBackTarget | undefined
} {
  const addRoute = (route: RouteLocationNormalized) => {
    if (blacklistedRouteNames.value.includes(route.name as RouteRecordName)) {
      return
    }

    // A list filter rewrites its hash with `history.replaceState`, which the router never sees.
    // On a push the address bar still shows the route being left, so its hash is the one to return to.
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

  /** Replaces the whole list, so two callers overwrite each other. Use `addBlacklistedRoute` to add one. */
  const setBlacklistedRoutes = (routeNames: RouteRecordName[]) => {
    blacklistedRouteNames.value = routeNames
  }

  const addBlacklistedRoute = (routeName: RouteRecordName) => {
    if (!blacklistedRouteNames.value.includes(routeName)) {
      blacklistedRouteNames.value.push(routeName)
    }
  }

  // Internal on purpose. Called directly, it lacks the current-route exclusion that `navigateBack` adds.
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

    // The current route is never a destination. `addRoute` runs in `beforeEach`, so a navigation
    // cancelled by a later guard still records it, and pushing it again is a silent no-op.
    // The check runs inside the walk, not on its result. A nameless current route is recognised only
    // by its path, and rejecting the result afterwards would stop the walk instead of continuing.
    // Names use `===` so symbol names work, but only when the current route has
    // a name: two nameless routes are both `undefined` and not the same place.
    const isCurrent = (route: RouteHistoryEntry) =>
      route.fullPath === current.fullPath || (current.name !== undefined && route.name === current.name)

    const route = findRouteBack((entry) => !isCurrent(entry) && !skip.includes(entry.name))

    if (route) {
      const generation = historyGeneration
      const navigation = router.push(route.fullPath)
      // Back on `route`, the entries after it are behind the user. Kept, they become
      // the next Close's destination, and Close ping-pongs between two details.
      // They are dropped only after landing, so a navigation stopped by a
      // guard or cancelled by a second click leaves the history unchanged.
      // `Promise.resolve` because a test double's `push` may return nothing.
      Promise.resolve(navigation).then(
        (failure) => {
          if (failure || generation !== historyGeneration) return
          // Missing without `clearHistory` means `route` was pushed out
          // at the front by `MAX_HISTORY`. Everything left came after it.
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
