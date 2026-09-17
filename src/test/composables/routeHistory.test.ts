import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouteHistory } from '@/composables/system/routeHistory'

// `navigateBack` never hands back the route the user is already on.
//
// The history is filled from a `beforeEach` guard, which records the route being LEFT — and that
// guard also runs for a navigation a later guard then cancels. The route we stayed on is therefore
// the last entry often enough to matter, and `router.push` of the current path resolves to nothing:
// no error, no log, a close button that visibly does not work. Callers used to have to name their
// own route in `skipRouteNames` to avoid it; now they do not.

const { addRoute, clearHistory, navigateBack, setBlacklistedRoutes } = useRouteHistory()

// `name` is deliberately optional here: vue-router route names are, and the nameless case is the
// one the walk gets wrong if the current-route test is applied to its result instead of inside it.
type RouteName = string | symbol | undefined

const visit = (name: RouteName, fullPath: string) =>
  (addRoute as (route: { name: RouteName; fullPath: string }) => void)({ name, fullPath })

const routerOn = (name: RouteName, fullPath = typeof name === 'string' ? name : '/') => ({
  push: vi.fn(),
  back: vi.fn(),
  currentRoute: { value: { name, fullPath } },
})

beforeEach(() => {
  clearHistory()
  setBlacklistedRoutes([])
})

describe('navigateBack', () => {
  it('walks past the route the caller is on without being told to', () => {
    visit('/records', '/records')
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('walks past another record of the same kind', () => {
    // Two rows of the same listing share a route name, and closing one should not open the other.
    visit('/records', '/records')
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/2')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('still honours the names the caller does give', () => {
    visit('/records', '/records')
    visit('/records/new', '/records/new')

    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { skipRouteNames: ['/records/new'], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('falls back when the walk finds only the current route', () => {
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records', fallbackRouteParams: { a: 1 } })

    expect(router.push).toHaveBeenCalledWith({ name: '/records', params: { a: 1 } })
  })

  it('walks by name even when the caller passes no options at all', () => {
    // There is no longer a second, positional way through: `navigateBack` always asks what the
    // entry IS, never where it sits. That branch had no user and was the shape the silent no-op
    // lived in -- one cancelled navigation and `stepsBack: 1` was the route we never left.
    visit('/records', '/records')
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never)

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('goes back through the router when there is no fallback and nothing to return to', () => {
    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { skipRouteNames: [] })

    expect(router.back).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('a current route with no name', () => {
  it('is walked past, not stopped at', () => {
    // A route name is optional in vue-router, so the only way to recognise a nameless current route
    // is its path. Test that after the walk instead of inside it and the walk stops at the nameless
    // entry, its result is discarded, and a perfectly good older destination one line up is never
    // reached -- the user lands on the fallback for no reason.
    visit('/records', '/records')
    visit(undefined, '/plain-current')

    const router = routerOn(undefined, '/plain-current')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('does not swallow a different nameless route', () => {
    // Two nameless routes are both `undefined`; that is not a reason to treat them as one place.
    visit('/records', '/records')
    visit(undefined, '/plain-older')

    const router = routerOn(undefined, '/plain-current')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/plain-older')
  })
})

describe('a current route named by a symbol', () => {
  it('is recognised as the same route at a different url', () => {
    // vue-router route names are `string | symbol | undefined`, so the current route is compared
    // with `===` rather than by string membership. Another url of the SAME symbol-named route is
    // another record of the same kind -- not somewhere to hand the user back to.
    const record = Symbol('record')
    visit('/records', '/records')
    visit(record, '/records/1')

    const router = routerOn(record, '/records/2')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })
})
