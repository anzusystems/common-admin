import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ANotFoundView from '@/domains/ui/view/components/ANotFoundView.vue'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'

const Empty = defineComponent(() => () => null)
const { addRoute, clearHistory } = useRouteHistory()
let router: Router
let wrapper: VueWrapper | undefined

beforeEach(() => {
  clearHistory()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: '/', component: Empty },
      { path: '/records', name: '/records', component: Empty },
      { path: '/:pathMatch(.*)', name: '/[...pathMatch]', component: Empty },
    ],
  })
  router.beforeEach((_to, from) => {
    if (from.name) addRoute(from)
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const mountView = () => mount(ANotFoundView, { props: { returnRouteName: '/' }, global: { plugins: [router] } })

describe('ANotFoundView', () => {
  it('goes back to the list a stale record address was opened from', async () => {
    await router.push('/records')
    await router.push('/records/abc')
    wrapper = mountView()

    await wrapper.get('[data-cy="not-found-back"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/records')
  })

  it('goes home from a tab opened on the bad address, never out of the application', async () => {
    await router.push('/records/abc')
    wrapper = mountView()

    await wrapper.get('[data-cy="not-found-back"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
  })
})
