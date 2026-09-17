import type { RouteLocationNormalized, Router } from 'vue-router'
import { type DeepReadonly, readonly, type Ref, ref } from 'vue'

// Module state, so the history is one list per document. A test that fills it has to clear it
// again (`clearHistory`), or the next test in the file reads what the previous one left behind.
const history = ref<RouteLocationNormalized[]>([])
const blacklistedRouteNames = ref<string[]>([])
/**
 * How many routes back the history reaches. Note that `addRoute` drops only CONSECUTIVE duplicates,
 * so a user bouncing A -> B -> A -> B fills four of these slots and can push the listing they want
 * to return to out of the window. `fallbackRouteName` is what catches that.
 */
const MAX_HISTORY = 10

export interface NavigateBackOptions {
  /**
   * How many entries back to take when `skipRouteNames` is not given. Rarely what you want: it
   * counts positions rather than asking what the entry is.
   */
  stepsBack?: number
  /**
   * Route names that are not a destination -- typically the sibling views of the record being
   * closed and the create form it may have been reached from. The CURRENT route is always skipped
   * on top of these, so there is no need to name it here.
   */
  skipRouteNames?: string[]
  /** Where to go when the walk finds nothing -- a tab opened straight on the record. */
  fallbackRouteName?: string
  fallbackRouteParams?: Record<string, any>
}

export function useRouteHistory(): {
  history: DeepReadonly<Ref<RouteLocationNormalized[]>>
  addRoute: (route: RouteLocationNormalized) => void
  getRouteBack: (steps?: number) => RouteLocationNormalized | undefined
  getFirstRouteNotMatching: (routeNamesToSkip: string[]) => RouteLocationNormalized | undefined
  clearHistory: () => void
  setBlacklistedRoutes: (routeNames: string[]) => void
  addBlacklistedRoute: (routeName: string) => void
  navigateBack: (router: Router, options?: NavigateBackOptions) => void
} {
  const addRoute = (route: RouteLocationNormalized) => {
    if (blacklistedRouteNames.value.includes(route.name as string)) {
      return
    }

    const lastRoute = history.value[history.value.length - 1]
    if (lastRoute && lastRoute.fullPath === route.fullPath) {
      return
    }

    history.value.push(route)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
  }

  /** REPLACES the list. Two callers would overwrite each other -- to add one, use `addBlacklistedRoute`. */
  const setBlacklistedRoutes = (routeNames: string[]) => {
    blacklistedRouteNames.value = routeNames
  }

  const addBlacklistedRoute = (routeName: string) => {
    if (!blacklistedRouteNames.value.includes(routeName)) {
      blacklistedRouteNames.value.push(routeName)
    }
  }

  const getRouteBack = (steps: number = 1): RouteLocationNormalized | undefined => {
    const index = history.value.length - steps
    return index >= 0 ? history.value[index] : undefined
  }

  const getFirstRouteNotMatching = (routeNamesToSkip: string[]): RouteLocationNormalized | undefined => {
    for (let i = history.value.length - 1; i >= 0; i--) {
      const route = history.value[i]
      if (!routeNamesToSkip.includes(route.name as string)) {
        return route
      }
    }
    return undefined
  }

  const clearHistory = () => {
    history.value = []
  }

  const navigateBack = (router: Router, options: NavigateBackOptions = {}) => {
    const { stepsBack = 1, skipRouteNames, fallbackRouteName, fallbackRouteParams } = options

    // The route we are on is never a place to go back to, whichever way the entry was found.
    // `addRoute` runs in `beforeEach`, so a navigation that a later guard cancels still records the
    // route we never left -- and pushing that again is a silent no-op, which reads as the button
    // doing nothing at all. Callers therefore do not name their own route in `skipRouteNames`.
    const currentName = router.currentRoute.value.name
    const skip = [...(skipRouteNames ?? []), ...(typeof currentName === 'string' ? [currentName] : [])]

    const found = skipRouteNames ? getFirstRouteNotMatching(skip) : getRouteBack(stepsBack)
    const route = found?.fullPath === router.currentRoute.value.fullPath ? undefined : found

    if (route) {
      router.push(route.fullPath)
    } else if (fallbackRouteName) {
      router.push({ name: fallbackRouteName, params: fallbackRouteParams })
    } else {
      router.back()
    }
  }

  return {
    history: readonly(history),
    addRoute,
    getRouteBack,
    getFirstRouteNotMatching,
    clearHistory,
    setBlacklistedRoutes,
    addBlacklistedRoute,
    navigateBack,
  }
}
