import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory, type Router, type RouterHistory, RouterView, useRoute } from 'vue-router'
import type { AxiosInstance } from 'axios'
import ALogListView from '@/domains/log/components/ALogListView.vue'
import { DEFAULT_LOG_PATHS, type LogTypeType } from '@/domains/log/composables/logType'
import { logFilterStorageKey, resetLogFilterRegistry, useLogFilter } from '@/domains/log/filter/logFilter'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

// The switch between app and audit logs replaces the route without a hash, and the page remounts the list by type.
// It keeps the filter the user has (the registry is per system on purpose), starts on the first page and puts the
// filter into the address. Each type keeps its own page: for the menu, F5 and Close.

const urls: string[] = []
const get = vi.fn((url: string) => {
  urls.push(url)
  return Promise.resolve({ status: 200, data: { data: [], totalCount: 500 }, config: {} })
})
const client = () => ({ get }) as unknown as AxiosInstance

const Page = defineComponent(() => {
  const route = useRoute()
  return () => {
    const type = route.params.type as LogTypeType
    return h(ALogListView, {
      key: type,
      client,
      system: 'cms',
      type,
      logPaths: DEFAULT_LOG_PATHS,
      detailRoute: () => '/',
      typeRoute: (to: LogTypeType) => ({ name: 'logs', params: { type: to } }),
    })
  }
})
const Empty = defineComponent(() => () => null)

const start = location.pathname + location.search
let webHistory: RouterHistory
let router: Router
let wrapper: VueWrapper | undefined

beforeEach(async () => {
  resetLogFilterRegistry()
  localStorage.clear()
  urls.length = 0
  webHistory = createWebHistory()
  router = createRouter({
    history: webHistory,
    routes: [
      { path: '/logs/:type', name: 'logs', component: Page },
      { path: '/logs/:type/:id', name: 'detail', component: Empty },
    ],
  })
  await router.push({ name: 'logs', params: { type: 'app' } })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  webHistory.destroy()
  window.history.replaceState(null, '', start)
  localStorage.clear()
})

/** Runs `act` and returns the list request it leads to, once it went out: the load is debounced. */
const requested = async (act: () => unknown): Promise<string> => {
  const before = urls.length
  await act()
  await vi.waitFor(() => expect(urls.length).toBeGreaterThan(before), { timeout: 5000 })
  await flushPromises()
  return urls.at(-1)!
}

const mountApp = () =>
  requested(() => {
    wrapper = mount(
      defineComponent(() => () => h(RouterView)),
      { global: { plugins: [router], stubs: { ALogFilter: true } } }
    )
  })

const filterBar = () => wrapper!.findComponent({ name: 'ALogFilter' })
const filter = () => useLogFilter('cms', undefined).filterData
const submit = () => requested(() => filterBar().vm.$emit('submit'))
// The filter bar empties the fields before it emits.
const reset = () => {
  filter().contextId = null
  filter().message = null
  return requested(() => filterBar().vm.$emit('reset'))
}
const switchTo = (type: LogTypeType) => requested(() => filterBar().vm.$emit('changeType', type))
const open = (type: LogTypeType) => requested(() => router.push({ name: 'logs', params: { type } }))
// Past the 300 ms the pager's buttons are throttled for.
const nextPage = async () => {
  await new Promise((resolve) => setTimeout(resolve, 310))
  return requested(() => wrapper!.find('.anzu-data-footer__icons-after button').trigger('click'))
}

describe('the switch between app and audit logs', () => {
  it('keeps the filter shown, also over a view the other type saved before', async () => {
    localStorage.setItem(logFilterStorageKey('cms', 'audit'), 'contextId=A&_sort=id,desc~')
    await mountApp()
    filter().contextId = 'B'
    await submit()

    const url = await switchTo('audit')

    expect(router.currentRoute.value.params.type).toBe('audit')
    expect(filter().contextId).toBe('B')
    expect(url).toContain(DEFAULT_LOG_PATHS.audit)
    expect(url).toContain('filter_eq[context.contextId]=B')
    expect(location.hash).toBe('#contextId=B&_sort=id,desc~')
  })

  it('puts the filter into the address, so a reload or a link shows it', async () => {
    await mountApp()
    filter().contextId = 'B'
    await submit()
    await switchTo('audit')
    expect(location.hash).toBe('#contextId=B&_sort=id,desc~')

    wrapper!.unmount()
    resetLogFilterRegistry()
    const url = await mountApp()

    expect(filter().contextId).toBe('B')
    expect(url).toContain(DEFAULT_LOG_PATHS.audit)
    expect(url).toContain('filter_eq[context.contextId]=B')
  })

  it('opens the other type on its first page, and each type keeps its own page for Close and the menu', async () => {
    await mountApp()
    expect(await nextPage()).toContain('offset=25')

    const audit = await switchTo('audit')
    expect(audit).toContain(DEFAULT_LOG_PATHS.audit)
    expect(audit).toContain('offset=0')
    await nextPage()
    expect(await nextPage()).toContain('offset=50')

    // Close of a detail of audit logs: back to the list without its hash, on the page it was left on.
    await router.push({ name: 'detail', params: { type: 'audit', id: 'x' } })
    useDatatablePageStore().setPreservePage()
    const closed = await open('audit')
    expect(closed).toContain(DEFAULT_LOG_PATHS.audit)
    expect(closed).toContain('offset=50')

    // The menu opens app logs, without a hash.
    const menu = await open('app')
    expect(menu).toContain(DEFAULT_LOG_PATHS.app)
    expect(menu).toContain('offset=25')
  })

  // With nothing to carry, the switch wrote `_sort=id,desc~`, which the other type put into the address. The e2e of
  // admin-forum and admin-inhouse wait for the address of the type with nothing after it.
  it('opens the other type without a hash when there is nothing to carry but the default sort', async () => {
    localStorage.setItem(logFilterStorageKey('cms', 'audit'), 'contextId=A&_sort=id,desc&_page=3&_limit=25~')
    await mountApp()
    filter().contextId = 'B'
    await submit()
    await reset()

    const url = await switchTo('audit')

    expect(location.pathname).toMatch(/\/logs\/audit$/)
    expect(location.hash).toBe('')
    expect(localStorage.getItem(logFilterStorageKey('cms', 'audit'))).toBeNull()
    expect(url).toContain(DEFAULT_LOG_PATHS.audit)
    expect(url).not.toContain('contextId')
    expect(url).toContain('offset=0')
  })

  it('carries a sort other than the default into the address', async () => {
    await router.replace({ name: 'logs', params: { type: 'app' }, hash: '#_sort=id,asc~' })
    await mountApp()

    const url = await switchTo('audit')

    expect(location.hash).toBe('#_sort=id,asc~')
    expect(url).toContain('order[id]=asc')
  })

  // The registry holds the filter of the type shown last. Merged into the view the other type saved,
  // it showed a filter the address did not have.
  it('shows a type opened without an address as it saved it', async () => {
    await mountApp()
    filter().contextId = 'B'
    await submit()
    await switchTo('audit')
    filter().message = 'Kernel'
    await submit()

    const url = await open('app')

    expect([filter().contextId, filter().message]).toEqual(['B', null])
    expect(location.hash).toBe('#contextId=B&_sort=id,desc~')
    expect(url).toContain(DEFAULT_LOG_PATHS.app)
    expect(url).not.toContain('message')
  })
})
