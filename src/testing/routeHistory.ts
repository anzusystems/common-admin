import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteRecordName } from 'vue-router'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import { parseTypedRouterDeclaration } from '@/testing/typedRouter'

export interface DescribeRouteHistoryOptions {
  declaration: string
  routeHistoryBlacklist: readonly string[]
  initRouteHistory: () => void
}

/**
 * `describeCloseButtons` checks that every button names the right routes. This checks that naming them does anything.
 * The history is module state in the library, filled by the navigation guard and read
 * by `navigateBack`, so the admin's set-up and the library are only correct together.
 * Route names come from the declaration. Made-up names would be rejected
 * by `anzu/valid-route-name`, and real ones keep the test honest.
 */
export function describeRouteHistory({
  declaration,
  routeHistoryBlacklist,
  initRouteHistory,
}: DescribeRouteHistoryOptions): void {
  const { history, addRoute, clearHistory, navigateBack } = useRouteHistory()

  const [listing, record] = parseTypedRouterDeclaration(declaration).names.filter(
    (name) => !routeHistoryBlacklist.includes(name)
  )

  // The history only ever reads these two fields of the route.
  const visit = (name: string, fullPath = name) =>
    (addRoute as (route: { name: string; fullPath: string }) => void)({ name, fullPath })

  const recorded = () => history.value.map((route) => route.name)

  // `navigateBack` reads the route it is called from -- it never hands that one back -- so the
  // double has to carry one. These cases all run as if the user were on a record view.
  const routerOn = (name: string, fullPath = name) => ({
    push: vi.fn(),
    back: vi.fn(),
    currentRoute: { value: { name, fullPath } },
  })

  describe('route history', () => {
    beforeEach(() => {
      clearHistory()
      initRouteHistory()
    })

    it('has two routes to work with', () => {
      // Guards the guard: were the declaration unreadable, every assertion below would compare
      // `undefined` against `undefined` and pass while checking nothing.
      expect(listing).toBeTypeOf('string')
      expect(record).toBeTypeOf('string')
      expect(routeHistoryBlacklist.length).toBeGreaterThan(0)
    })

    it('records an ordinary route, once', () => {
      visit(listing!)
      visit(listing!)
      visit(record!)

      // The guard fires again on a navigation that a later guard then cancels, so the same route
      // arrives twice in a row; a second copy would cost one of the ten slots for nothing.
      expect(recorded()).toEqual([listing, record])
    })

    it('keeps every blacklisted route out', () => {
      for (const name of routeHistoryBlacklist) visit(name)

      expect(recorded()).toEqual([])
    })

    it('walks back past the view being closed to the one before it', () => {
      // With an empty skip list, exactly as the buttons pass it: the view being closed is the one the
      // router is on, and `navigateBack` never hands that back.
      visit(listing!)
      visit(record!)

      const router = routerOn(record!)
      navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: listing as RouteRecordName })

      expect(router.push).toHaveBeenCalledWith(listing)
      expect(router.back).not.toHaveBeenCalled()
    })

    it('falls back when history holds nothing but the view being closed', () => {
      visit(record!)

      const router = routerOn(record!)
      navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: listing as RouteRecordName })

      expect(router.push).toHaveBeenCalledWith({ name: listing, params: undefined })
    })

    it('does not hand back a route the blacklist rejected', () => {
      visit(listing!)
      visit(routeHistoryBlacklist[0]!)

      const router = routerOn(record!)
      navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: listing as RouteRecordName })

      expect(router.push).toHaveBeenCalledWith(listing)
    })
  })
}
