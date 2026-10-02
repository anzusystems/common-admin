import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { AxiosInstance } from 'axios'
import ALogDetailView from '@/domains/log/components/ALogDetailView.vue'
import { DEFAULT_LOG_PATHS } from '@/domains/log/composables/logType'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

// A log that cannot be loaded -- removed, or an address that names no log -- used to leave an empty
// card. The view now leaves the way a record page does: back to the list, the page's Close fallback.

let status = 404
const request = vi.fn(() =>
  Promise.reject(Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status, data: {} } }))
)
const client = () => ({ request }) as unknown as AxiosInstance

const Empty = defineComponent(() => () => null)
const { clearHistory } = useRouteHistory()
let router: Router
let wrapper: VueWrapper | undefined

beforeEach(async () => {
  clearHistory()
  request.mockClear()
  status = 404
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/logs/:type', name: '/logs/[type]', component: Empty },
      { path: '/logs/:type/:id', name: '/logs/[type]/[id]', component: Empty },
    ],
  })
  await router.push('/logs/app/0123456789abcdef01234567')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const mountView = (props: Record<string, unknown> = {}) =>
  mount(ALogDetailView, {
    props: {
      client,
      system: 'cms',
      type: 'app',
      id: '0123456789abcdef01234567',
      logPaths: DEFAULT_LOG_PATHS,
      ...props,
    },
    global: { plugins: [router] },
  })

describe('ALogDetailView whose log cannot be loaded', () => {
  it('leaves to the list the page gives as its fallback', async () => {
    wrapper = mountView({ fallbackRouteName: '/logs/[type]', fallbackRouteParams: { type: 'app' } })
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.fullPath).toBe('/logs/app')
  })

  it('stays, with no card left loading, when it has nowhere to go', async () => {
    status = 500
    wrapper = mountView()
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/logs/app/0123456789abcdef01234567')
    // `v-show`: the loader's overlay is still in the card, hidden.
    expect(wrapper.get('.a-card-loader').attributes('style')).toContain('display: none')
  })
})
