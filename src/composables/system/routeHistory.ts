import type { RouteLocationNormalized, Router } from 'vue-router'
import { type DeepReadonly, readonly, type Ref, ref } from 'vue'

const history = ref<RouteLocationNormalized[]>([])
const blacklistedRouteNames = ref<string[]>([])
const MAX_HISTORY = 10

export interface NavigateBackOptions {
  stepsBack?: number
  skipRouteNames?: string[]
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

  const getFirstRouteNotMatching = (
    routeNamesToSkip: string[],
  ): RouteLocationNormalized | undefined => {
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

    const route = skipRouteNames
      ? getFirstRouteNotMatching(skipRouteNames)
      : getRouteBack(stepsBack)

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
