import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, type Router, type RouterHistory } from 'vue-router'
import ANotFoundView from '@/domains/ui/view/components/ANotFoundView.vue'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'

const Empty = defineComponent(() => () => null)
const { addRoute, clearHistory } = useRouteHistory()
let router: Router
let wrapper: VueWrapper | undefined

const makeRouter = (history: RouterHistory) => {
  router = createRouter({
    history,
    routes: [
      { path: '/', name: '/', component: Empty },
      { path: '/records', name: '/records', component: Empty },
      { path: '/:pathMatch(.*)', name: '/[...pathMatch]', component: Empty },
    ],
  })
  router.beforeEach((_to, from) => {
    if (from.name) addRoute(from)
  })
}

beforeEach(() => {
  clearHistory()
  makeRouter(createMemoryHistory())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const mountView = () => mount(ANotFoundView, { props: { returnRouteName: '/' }, global: { plugins: [router] } })

describe('ANotFoundView', () => {
  it('steps back to the list a stale record address was opened from', async () => {
    const start = location.pathname + location.search
    const webHistory = createWebHistory()
    try {
      makeRouter(webHistory)
      await router.push('/records')
      await router.push('/records/abc')
      const replace = vi.spyOn(router, 'replace')
      wrapper = mountView()

      await wrapper.get('[data-cy="not-found-back"]').trigger('click')
      await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/records'))

      // A step back: the bad address is the forward entry now, out of the browser's Back.
      expect(replace).not.toHaveBeenCalled()
    } finally {
      webHistory.destroy()
      window.history.replaceState(null, '', start)
    }
  })

  it('goes home from a tab opened on the bad address, never out of the application', async () => {
    await router.push('/records/abc')
    wrapper = mountView()

    await wrapper.get('[data-cy="not-found-back"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
  })
})
