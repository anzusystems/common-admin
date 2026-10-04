import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Component, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import type { AxiosError } from 'axios'
import {
  isNavigationPending,
  trackNavigation,
  usePageNavigation,
  type UsePageNavigationReturn,
} from '@/domains/system/composables/pageNavigation'
import { handleRecordLoadError, useRecordPage } from '@/domains/system/composables/recordPage'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'

// A page that acts after an asynchronous step does nothing while the user navigates elsewhere, or once the user has
// left: in production every page's chunk is fetched on its first visit, and the page's redirect would cancel the
// user's navigation, its message stay on the page the user went to.

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

const page = defineComponent(() => () => null)
// The destinations' chunks, held until the test lets them arrive.
let chunk = deferred()
let otherChunk = deferred()
let untrack: (() => void) | undefined
let wrapper: VueWrapper | undefined

const makeRouter = (pages: Record<string, Component> = {}) => {
  chunk = deferred()
  otherChunk = deferred()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/list', name: 'list', component: pages.list ?? page },
      { path: '/records/:id', name: 'record', component: pages.record ?? page },
      { path: '/lazy', name: 'lazy', component: () => chunk.promise.then(() => page) },
      { path: '/lazy-other', name: 'lazyOther', component: () => otherChunk.promise.then(() => page) },
      { path: '/unauthorized', name: 'unauthorized', component: page },
      { path: '/guarded', name: 'guarded', component: page, beforeEnter: () => '/unauthorized' },
    ],
  })
  untrack = trackNavigation(router)
  router.beforeEach((_to, from) => {
    if (from.name) useRouteHistory().addRoute(from)
  })
  return router
}

// As the admins' App.vue: the view keyed by the path.
const mountApp = (router: Router) => {
  wrapper = mount(
    defineComponent({
      setup: () => () => h(RouterView, { key: router.currentRoute.value.path }),
    }),
    { global: { plugins: [router] } }
  )
}

beforeEach(async () => {
  useRouteHistory().clearHistory()
  const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
  vi.mocked(pushAlert).mockClear()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  untrack?.()
  untrack = undefined
})

describe('trackNavigation', () => {
  it('is pending while the destination chunk loads, and not once it has arrived', async () => {
    const router = makeRouter()
    await router.push('/list')
    const navigation = router.push('/lazy')
    await settle()
    expect(isNavigationPending(router)).toBe(true)

    chunk.resolve()
    await navigation
    expect(isNavigationPending(router)).toBe(false)
  })

  it('stays pending when a newer navigation cancels an older one, until the newer one ends', async () => {
    const router = makeRouter()
    await router.push('/list')
    const older = router.push('/lazy')
    await settle()
    const newer = router.push('/records/1')
    await newer
    expect(isNavigationPending(router)).toBe(false)
    chunk.resolve()
    await older
    expect(isNavigationPending(router)).toBe(false)
  })

  it('stays pending while the newer navigation loads, when the older one it cancelled resumes', async () => {
    const router = makeRouter()
    await router.push('/list')
    const older = router.push('/lazy')
    await settle()
    const newer = router.push('/lazy-other')
    await settle()
    chunk.resolve()
    await older
    expect(isNavigationPending(router)).toBe(true)

    otherChunk.resolve()
    await newer
    expect(isNavigationPending(router)).toBe(false)
  })

  it('ends a guard redirect that lands on the current page, a duplicate', async () => {
    const router = makeRouter()
    await router.push('/unauthorized')
    await router.push('/guarded')
    expect(router.currentRoute.value.path).toBe('/unauthorized')
    expect(isNavigationPending(router)).toBe(false)
  })

  it('ends a navigation whose chunk fails to load', async () => {
    const router = makeRouter()
    router.onError(() => undefined)
    await router.push('/list')
    const navigation = router.push('/lazy').catch(() => undefined)
    await settle()
    chunk.reject(new Error('chunk'))
    await navigation
    expect(isNavigationPending(router)).toBe(false)
  })
})

describe('usePageNavigation', () => {
  let nav: UsePageNavigationReturn | undefined
  const recordPage = defineComponent({
    setup() {
      nav = usePageNavigation()
      return () => null
    },
  })

  it('navigates when the user is still on the page', async () => {
    const router = makeRouter({ record: recordPage })
    await router.push('/records/1')
    mountApp(router)
    await nextTick()

    expect(nav!.onPage()).toBe(true)
    expect(await nav!.push('/list')).toBe(true)
    expect(router.currentRoute.value.path).toBe('/list')
  })

  it('does nothing while the user navigates elsewhere, and leaves the user’s navigation be', async () => {
    const router = makeRouter({ record: recordPage })
    await router.push('/records/1')
    mountApp(router)
    await nextTick()
    const userNavigation = router.push('/lazy')
    await settle()

    expect(nav!.onPage()).toBe(false)
    expect(await nav!.push('/list')).toBe(false)
    chunk.resolve()
    expect(await userNavigation).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/lazy')
  })

  it('does nothing for a page the user has left, also when the same path is shown again', async () => {
    const router = makeRouter({ record: recordPage })
    await router.push('/records/1')
    mountApp(router)
    await nextTick()
    const first = nav!
    await router.push('/list')
    await router.push('/records/1')
    await nextTick()

    expect(first.onPage()).toBe(false)
    expect(await first.push('/list')).toBe(false)
    expect(router.currentRoute.value.path).toBe('/records/1')
    expect(nav!.onPage()).toBe(true)
  })

  it('stays on the page when only the query changes', async () => {
    const router = makeRouter({ record: recordPage })
    await router.push('/records/1')
    mountApp(router)
    await nextTick()
    await router.push('/records/1?tab=history')

    expect(nav!.onPage()).toBe(true)
  })

  it('throws a location the router cannot resolve where the caller catches it', async () => {
    const router = makeRouter({ record: recordPage })
    await router.push('/records/1')
    mountApp(router)
    await nextTick()

    expect(() => nav!.push({ name: 'no-such-route' })).toThrow()
  })

  it('without a router, follows nothing and navigates nowhere', async () => {
    let alone: UsePageNavigationReturn | undefined
    wrapper = mount(
      defineComponent({
        setup() {
          alone = usePageNavigation()
          return () => null
        },
      })
    )

    expect(alone!.onPage()).toBe(true)
    expect(await alone!.push('/list')).toBe(false)
  })

  it('still navigates from a child that its own action unmounts', async () => {
    const shown = ref(true)
    let push: UsePageNavigationReturn['push'] | undefined
    const button = defineComponent({
      setup() {
        push = usePageNavigation().push
        return () => null
      },
    })
    const withButton = defineComponent({ setup: () => () => (shown.value ? h(button) : null) })
    const router = makeRouter({ record: withButton })
    await router.push('/records/1')
    mountApp(router)
    await nextTick()

    // The action's success hides the button before its redirect runs.
    shown.value = false
    await nextTick()
    expect(await push!('/list')).toBe(true)
    expect(router.currentRoute.value.path).toBe('/list')
  })
})

describe('a record page whose load fails while the user navigates elsewhere', () => {
  const axiosError = (status: number) =>
    new AnzuApiAxiosError({ isAxiosError: true, response: { status } } as unknown as AxiosError)
  let leave: (() => Promise<boolean>) | undefined
  const failingPage = (loading?: Ref<boolean>) =>
    defineComponent({
      setup() {
        leave = useRecordPage({ fallbackRouteName: 'list', loading }).leave
        return () => null
      },
    })

  it('shows no message and does not leave: the user lands where they went', async () => {
    const loading = ref(false)
    const router = makeRouter({ record: failingPage(loading) })
    await router.push('/list')
    await router.push('/records/1')
    mountApp(router)
    await nextTick()
    const userNavigation = router.push('/lazy')
    await settle()

    expect(handleRecordLoadError(axiosError(404))).toBe(true)
    expect(await leave!()).toBe(false)
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(loading.value).toBe(true)
    chunk.resolve()
    expect(await userNavigation).toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/lazy')
    const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
    expect(pushAlert).not.toHaveBeenCalled()
  })

  it('shows the message and leaves when the user stays', async () => {
    const router = makeRouter({ record: failingPage() })
    await router.push('/list')
    await router.push('/records/1')
    mountApp(router)
    await nextTick()

    expect(handleRecordLoadError(axiosError(404))).toBe(true)
    expect(await leave!()).toBe(true)
    expect(router.currentRoute.value.path).toBe('/list')
    const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
    expect(pushAlert).toHaveBeenCalledTimes(1)
  })
})
