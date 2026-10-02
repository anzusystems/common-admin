import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, createWebHistory, type Router, type RouterHistory } from 'vue-router'
import type { AxiosError } from 'axios'
import {
  handleRecordLoadError,
  useRecordPage,
  type UseRecordPageOptions,
} from '@/domains/system/composables/recordPage'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import {
  createFilter,
  createFilterStore,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { commonT } from '@/plugins/i18n'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

const axiosError = (status: number) =>
  new AnzuApiAxiosError({ isAxiosError: true, response: { status } } as unknown as AxiosError)

const alerts = async () => {
  const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
  return vi.mocked(pushAlert)
}

describe('handleRecordLoadError', () => {
  beforeEach(async () => (await alerts()).mockClear())

  it('says a missing record does not exist, and leaves', async () => {
    expect(handleRecordLoadError(axiosError(404))).toBe(true)
    expect(await alerts()).toHaveBeenCalledWith('error', commonT('common.alert.recordNotFound'), -1000)
  })

  it('says a refused record is not the user’s to see, whichever class the 403 arrives as', async () => {
    expect(handleRecordLoadError(new AnzuApiForbiddenError())).toBe(true)
    expect(handleRecordLoadError(new AnzuApiResponseCodeError(403))).toBe(true)
    const notify = await alerts()
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenNthCalledWith(1, 'error', commonT('common.alert.recordForbidden'), -1000)
    expect(notify).toHaveBeenNthCalledWith(2, 'error', commonT('common.alert.recordForbidden'), -1000)
  })

  it('shows the general message for a server failure, a timeout and a bug, and leaves', async () => {
    expect(handleRecordLoadError(axiosError(500))).toBe(true)
    expect(handleRecordLoadError(new AnzuApiTimeoutError(new Error('timeout')))).toBe(true)
    expect(handleRecordLoadError(new TypeError('x is undefined'))).toBe(true)
    const notify = await alerts()
    expect(notify.mock.calls.map(([, text]) => text)).toEqual([
      commonT('common.alert.unknownError'),
      commonT('error.apiTimedOut.message'),
      commonT('common.alert.unknownError'),
    ])
  })

  it('stays silent and stays for a stopped request and an expired session', async () => {
    expect(handleRecordLoadError(new AnzuApiCancelledError(new Error('canceled')))).toBe(false)
    const expired = new AnzuApiAxiosError({ isAxiosError: true } as unknown as AxiosError)
    expired.cause = Object.assign(expired.cause, { cause: new SessionExpiredError() })
    expect(handleRecordLoadError(expired)).toBe(false)
    expect(await alerts()).not.toHaveBeenCalled()
  })
})

const page = defineComponent(() => () => null)
const routes = [
  { path: '/records', name: '/records', component: page },
  { path: '/records/new', name: '/records/new', component: page },
  { path: '/records/:id(\\d+)', name: '/records/[id]', component: page },
  { path: '/records/:id(\\d+)/edit', name: '/records/[id]/edit', component: page },
  { path: '/records/:id(\\d+)/versions/:version?', name: '/records/[id]/versions/[[version]]', component: page },
  { path: '/other', name: '/other', component: page },
]

const { addRoute, clearHistory } = useRouteHistory()

const makeRouter = (history: RouterHistory = createMemoryHistory()) => {
  const router = createRouter({ history, routes })
  router.beforeEach((_to, from) => {
    if (from.name) addRoute(from)
  })
  return router
}

const mountRecordPage = (router: Router, options: UseRecordPageOptions) => {
  let api: ReturnType<typeof useRecordPage> | undefined
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useRecordPage(options)
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } }
  )
  return { wrapper, api: api! }
}

const detailOptions = (loading?: Ref<boolean>): UseRecordPageOptions => ({
  fallbackRouteName: '/records',
  skipRouteNames: ['/records/[id]/edit', '/records/new'],
  loading,
})

let wrapper: VueWrapper | undefined
beforeEach(() => clearHistory())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('useRecordPage', () => {
  it('goes back to the view the user came from, without a trace of the failed address', async () => {
    const router = makeRouter()
    await router.push('/other')
    await router.push('/records/7')
    const mounted = mountRecordPage(router, detailOptions())
    wrapper = mounted.wrapper

    expect(await mounted.api.leave()).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/other')
    // Replaced, not pushed: going back now leaves /other, not to the failed record.
    router.back()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.currentRoute.value.fullPath).not.toBe('/records/7')
  })

  it('skips this record’s other views and the create form, not another record', async () => {
    const router = makeRouter()
    await router.push('/records/3')
    await router.push('/records/new')
    await router.push('/records/7/edit?tab=main')
    await router.push('/records/7')
    const mounted = mountRecordPage(router, detailOptions())
    wrapper = mounted.wrapper

    expect(await mounted.api.leave()).toBe(true)
    // /records/7/edit (same record, query ignored) and /records/new are skipped; record 3 is where the user was.
    expect(router.currentRoute.value.fullPath).toBe('/records/3')
  })

  it('skips a sibling with an optional param for this record only', async () => {
    const router = makeRouter()
    await router.push('/records/3/versions/2')
    await router.push('/records/7')
    const mounted = mountRecordPage(router, {
      ...detailOptions(),
      skipRouteNames: ['/records/[id]/versions/[[version]]'],
    })
    wrapper = mounted.wrapper

    expect(await mounted.api.leave()).toBe(true)
    // Record 3's version is where the user was; only record 7's versions are its sibling view.
    expect(router.currentRoute.value.fullPath).toBe('/records/3/versions/2')
  })

  it('falls back to the list when the history has nowhere to go', async () => {
    const router = makeRouter()
    await router.push('/records/7')
    const mounted = mountRecordPage(router, detailOptions())
    wrapper = mounted.wrapper

    expect(await mounted.api.leave()).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/records')
  })

  it('does not move a user who already left the record', async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/7')
    const mounted = mountRecordPage(router, detailOptions())
    wrapper = mounted.wrapper
    await router.push('/other')

    expect(await mounted.api.leave()).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/other')
  })

  it('holds the loading flag up, and keeps it up when the leave cannot land', async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/7')
    router.beforeEach((to) => (to.path === '/records' ? false : undefined))
    const loading = ref(false)
    const mounted = mountRecordPage(router, detailOptions(loading))
    wrapper = mounted.wrapper

    expect(await mounted.api.leave()).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/records/7')
    // The record is not loaded: its Save and Delete must not come back.
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(loading.value).toBe(true)
  })

  it('lowers the loading flag when the page goes, for the next view of the entity that loads nothing', async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/7')
    const loading = ref(false)
    const mounted = mountRecordPage(router, detailOptions(loading))

    expect(await mounted.api.leave()).toBe(true)
    mounted.wrapper.unmount()

    // eslint-disable-next-line vue/no-ref-object-reactivity-loss -- final read for an assertion
    expect(loading.value).toBe(false)
  })

  it('stops the record’s request when the page goes', () => {
    const router = makeRouter()
    const mounted = mountRecordPage(router, detailOptions())
    expect(mounted.api.signal.aborted).toBe(false)

    mounted.wrapper.unmount()

    expect(mounted.api.signal.aborted).toBe(true)
  })

  it('steps back instead of replacing when the target is the entry right before', async () => {
    const start = location.pathname + location.search
    const webHistory = createWebHistory()
    try {
      const router = makeRouter(webHistory)
      await router.push('/records')
      await router.push('/records/7')
      const replace = vi.spyOn(router, 'replace')
      const mounted = mountRecordPage(router, detailOptions())
      wrapper = mounted.wrapper

      expect(await mounted.api.leave()).toBe(true)
      expect(router.currentRoute.value.fullPath).toBe('/records')
      expect(replace).not.toHaveBeenCalled()
    } finally {
      webHistory.destroy()
      window.history.replaceState(null, '', start)
    }
  })

  it('steps back to a list whose filter wrote its hash, and lands on that filter', async () => {
    const start = location.pathname + location.search
    const webHistory = createWebHistory()
    try {
      const router = makeRouter(webHistory)
      await router.push('/records')
      const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption[]
      const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
        system: 'sys',
        subject: 'recordPage',
      })
      filterData.name = 'b'
      useFilterHelpers(filterData, filterConfig).submitFilter(usePagination('id').pagination)
      await new Promise((resolve) => setTimeout(resolve, 50))
      const filtered = location.pathname + location.hash
      await router.push('/records/7')
      const replace = vi.spyOn(router, 'replace')
      const mounted = mountRecordPage(router, detailOptions())
      wrapper = mounted.wrapper

      expect(await mounted.api.leave()).toBe(true)
      // A step back: the list's entry is the previous one, hash included, and nothing is added.
      expect(replace).not.toHaveBeenCalled()
      expect(location.hash).not.toBe('')
      expect(location.pathname + location.hash).toBe(filtered)
    } finally {
      webHistory.destroy()
      window.history.replaceState(null, '', start)
      localStorage.clear()
    }
  })

  it('goes back again to a record that failed once and has loaded since', async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/3')
    wrapper = mount(page, { global: { plugins: [router] } })

    // Record 3 fails once ...
    const failed = mountRecordPage(router, detailOptions())
    expect(await failed.api.leave()).toBe(true)
    failed.wrapper.unmount()
    // ... is opened again and loads, and record 8 is opened from it and fails.
    await router.push('/records/3')
    const loaded = mountRecordPage(router, detailOptions())
    await router.push('/records/8')
    loaded.wrapper.unmount()
    const other = mountRecordPage(router, detailOptions())

    expect(await other.api.leave()).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/records/3')
    other.wrapper.unmount()
  })

  it('does not bounce between two failing records next to each other in the history', async () => {
    const router = makeRouter()
    await router.push('/records')
    await router.push('/records/3')
    await router.push('/records/8')
    // The app stays: with the last app using it unmounted, the router would reset to its start.
    wrapper = mount(page, { global: { plugins: [router] } })

    // Record 8 fails and goes back to record 3 ...
    const second = mountRecordPage(router, detailOptions())
    expect(await second.api.leave()).toBe(true)
    second.wrapper.unmount()
    expect(router.currentRoute.value.fullPath).toBe('/records/3')

    // ... which fails as well: its newest entry is record 8, just left, so it goes on to the list.
    const first = mountRecordPage(router, detailOptions())
    expect(await first.api.leave()).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/records')
    first.wrapper.unmount()
  })
})
