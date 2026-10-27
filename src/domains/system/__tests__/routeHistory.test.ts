import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises } from '@vue/test-utils'
import {
  createMemoryHistory,
  createRouter,
  isNavigationFailure,
  NavigationFailureType,
  type RouteRecordName,
  type Router,
} from 'vue-router'
import {
  type NavigateBackOptions,
  type RouteHistoryEntry,
  useRouteHistory,
} from '@/domains/system/composables/routeHistory'

// `navigateBack` never hands back the route the user is already on.
//
// The history is filled from a `beforeEach` guard, which records the route being LEFT — and that
// guard also runs for a navigation a later guard then cancels. The route we stayed on is therefore
// the last entry often enough to matter, and `router.push` of the current path resolves to nothing:
// no error, no log, a close button that visibly does not work. Callers used to have to name their
// own route in `skipRouteNames` to avoid it; now they do not.

const { addRoute, clearHistory, history, navigateBack, setBlacklistedRoutes } = useRouteHistory()

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

// The route a Close lands on ends the history: what came after it, the route just left included, is
// behind the user. Kept, a Close on a record reached by a link to another record went back to that one,
// and its Close back again, never to the list.
describe('a Close through the router', () => {
  const page = defineComponent(() => () => null)
  // Runs before the history records the route being left, as a leave guard does.
  let gate = () => true

  const makeRouter = () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/records', name: '/records', component: page },
        { path: '/records/new', name: '/records/new', component: page },
        { path: '/records/:id', name: '/records/[id]', component: page },
        { path: '/records/:id/edit', name: '/records/[id]/edit', component: page },
        { path: '/users/:id', name: '/users/[id]', component: page },
      ],
    })
    router.beforeEach(() => gate())
    router.beforeEach((_to, from) => {
      if (from.name) addRoute(from)
    })
    return router
  }

  const close = async (router: Router, options: NavigateBackOptions = {}) => {
    await navigateBack(router, { fallbackRouteName: '/records', ...options })?.navigation.catch(() => undefined)
    return router.currentRoute.value.fullPath
  }

  // A record, and from it a link to another one: a user chip, say.
  const onLinkedRecord = async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/1')
    await router.push('/users/2')
    return router
  }

  beforeEach(() => {
    gate = () => true
  })

  it('goes back to the record and from there to the list', async () => {
    const router = await onLinkedRecord()

    expect(await close(router)).toBe('/records/1')
    expect(await close(router)).toBe('/records')
    expect(history.value).toEqual([])
  })

  describe.each([
    [
      'a guard stops before the history records the route',
      () => {
        gate = () => false
        return () => (gate = () => true)
      },
    ],
    ['a guard stops after the history recorded the route', (router: Router) => router.beforeEach(() => false)],
    [
      'fails',
      (router: Router) => {
        const stopError = router.onError(() => undefined)
        const stopGuard = router.beforeEach(() => {
          throw new Error('broken')
        })
        return () => {
          stopGuard()
          stopError()
        }
      },
    ],
  ])('when %s', (_, block) => {
    it('leaves the way back as it was', async () => {
      const router = await onLinkedRecord()
      const unblock = block(router)
      expect(await close(router)).toBe('/users/2')
      unblock()

      expect(await close(router)).toBe('/records/1')
      expect(await close(router)).toBe('/records')
    })
  })

  it('lands once on a second click while the first Close is under way', async () => {
    const router = await onLinkedRecord()
    const releases: (() => void)[] = []
    const stop = router.beforeEach(() => new Promise<void>((resolve) => releases.push(resolve)))
    const first = navigateBack(router, { fallbackRouteName: '/records' })
    const second = navigateBack(router, { fallbackRouteName: '/records' })
    await flushPromises()
    releases.forEach((release) => release())
    expect(isNavigationFailure(await first?.navigation, NavigationFailureType.cancelled)).toBe(true)
    await second?.navigation
    stop()
    expect(router.currentRoute.value.fullPath).toBe('/records/1')

    expect(await close(router)).toBe('/records')
  })

  it('drops what a full history holds after the route the Close pushed out of it', async () => {
    // Ten routes are the most it keeps (`MAX_HISTORY`): another record, then ten of one kind, the last
    // of which the Close leaves. Recording that one pushes the other record out at the front.
    const router = makeRouter()
    await router.push('/users/2')
    for (let id = 1; id <= 10; id++) await router.push(`/records/${id}`)
    expect(history.value).toHaveLength(10)

    expect(await close(router)).toBe('/users/2')
    expect(await close(router)).toBe('/records')
  })

  it('leaves alone a history cleared while the Close is under way', async () => {
    const router = await onLinkedRecord()
    let release = () => {}
    const stop = router.beforeEach(() => new Promise<void>((resolve) => (release = resolve)))
    const closing = navigateBack(router, { fallbackRouteName: '/records' })
    await flushPromises()
    clearHistory()
    visit('/other', '/other')
    release()
    await closing?.navigation
    stop()

    expect(router.currentRoute.value.fullPath).toBe('/records/1')
    expect(history.value).toEqual([{ name: '/other', fullPath: '/other' }])
  })

  it('walks past the names it is told to skip on the way to the list', async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/1')
    await router.push('/records/1/edit')
    await router.push('/users/2')

    expect(await close(router)).toBe('/records/1/edit')
    expect(await close(router, { skipRouteNames: ['/records/new'] })).toBe('/records/1')
    expect(await close(router, { skipRouteNames: ['/records/[id]/edit', '/records/new'] })).toBe('/records')
  })

  it('falls back on an empty history and keeps what its navigation recorded', async () => {
    // A tab opened straight on the record.
    const router = makeRouter()
    await router.push('/records/1')
    expect(history.value).toEqual([])

    expect(await close(router)).toBe('/records')
    expect(history.value).toEqual([{ name: '/records/[id]', fullPath: '/records/1' }])
  })
})

// Route names are vue-router's `RouteRecordName`, which a typed router narrows to its own names, so a
// stale name in `skipRouteNames` or `fallbackRouteName` is a type error in the admin. The history keeps
// only what going back needs; the full route objects made reading it hit TS2589.
describe('types', () => {
  it('takes route names as vue-router types them', () => {
    expectTypeOf<NavigateBackOptions['skipRouteNames']>().toEqualTypeOf<RouteRecordName[] | undefined>()
    expectTypeOf<NavigateBackOptions['fallbackRouteName']>().toEqualTypeOf<RouteRecordName | undefined>()
  })

  it('records the name and the full path of a route', () => {
    ;(addRoute as (route: object) => void)({ name: 'list', fullPath: '/list?page=2', params: {}, meta: {} })
    expect(history.value).toEqual([{ name: 'list', fullPath: '/list?page=2' }])
    expectTypeOf(history.value).toEqualTypeOf<readonly RouteHistoryEntry[]>()
  })
})
