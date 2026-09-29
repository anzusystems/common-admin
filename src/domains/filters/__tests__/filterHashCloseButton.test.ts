import { afterEach, describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import {
  createFilter,
  createFilterStore,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms))
const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption[]

afterEach(() => localStorage.clear())

describe('close button (navigateBack) after a submit', () => {
  it('returns to the filter that was submitted, list entered with a hash (reload / link / Back)', async () => {
    const base = location.pathname + location.search
    const history = createWebHistory()
    const router = createRouter({
      history,
      routes: [
        { path: '/', name: 'list', component: { render: () => null } },
        { path: '/detail', name: 'detail', component: { render: () => null } },
      ],
    })
    const { addRoute, navigateBack, clearHistory } = useRouteHistory()
    clearHistory()
    router.beforeEach((to, from) => {
      if (from.name) addRoute(from)
    })
    await router.push(base + '#name=a&_sort=id,desc~')
    const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
      system: 'sys',
      subject: 'close',
    })
    const { pagination } = usePagination('id')
    const helpers = useFilterHelpers(filterData, filterConfig)
    helpers.loadStoredFilters(pagination)
    expect(filterData.name).toBe('a')
    filterData.name = 'b'
    helpers.submitFilter(pagination)
    await wait()
    await router.push({ name: 'detail' })
    await wait()
    navigateBack(router)
    await wait(100)
    // what the remounted list would do
    const again = createFilter(fields, createFilterStore(fields), { system: 'sys', subject: 'close' })
    useFilterHelpers(again.filterData, again.filterConfig).loadStoredFilters(usePagination('id').pagination)
    expect(location.hash).toBe('#name=b&_sort=id,desc~')
    expect(again.filterData.name).toBe('b')
    history.destroy()
  })
})
