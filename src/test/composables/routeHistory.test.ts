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

const visit = (name: string, fullPath = name) =>
  (addRoute as (route: { name: string; fullPath: string }) => void)({ name, fullPath })

const routerOn = (name: string, fullPath = name) => ({
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
    visit('/records')
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('walks past another record of the same kind', () => {
    // Two rows of the same listing share a route name, and closing one should not open the other.
    visit('/records')
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/2')
    navigateBack(router as never, { skipRouteNames: [], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })

  it('still honours the names the caller does give', () => {
    visit('/records')
    visit('/records/new')

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

  it('does not push the current route through the stepsBack branch either', () => {
    // Without `skipRouteNames` the entry is taken by position, which is exactly where the silent
    // no-op used to live: one cancelled navigation and `stepsBack: 1` is the route we never left.
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith({ name: '/records', params: undefined })
  })

  it('goes back through the router when there is no fallback and nothing to return to', () => {
    const router = routerOn('/records/[id]', '/records/1')
    navigateBack(router as never, { skipRouteNames: [] })

    expect(router.back).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('the close button contract', () => {
  it('walks back by name even when the caller names nothing', () => {
    // `AActionCloseButtonHistory` defaults `skipRouteNames` to `[]` rather than leaving it unset,
    // so a button that has nothing to skip beyond its own route still takes the name walk. Left
    // undefined it would fall into the positional branch, which stops at the first entry whatever
    // that entry is.
    visit('/records')
    visit('/records/[id]', '/records/1')

    const router = routerOn('/records/new')
    navigateBack(router as never, { stepsBack: 1, skipRouteNames: ['/records/[id]'], fallbackRouteName: '/records' })

    expect(router.push).toHaveBeenCalledWith('/records')
  })
})
