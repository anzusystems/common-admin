import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import {
  createFilter,
  createFilterStore,
  useFilterClearHelpers,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'
import type { ValueObjectOption } from '@/shared/types/ValueObject'

const setup = <F extends readonly MakeFilterOption<string>[]>(fields: F, subject = 'subj') => {
  const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), { system: 'sys', subject })
  const { pagination } = usePagination('id')
  return { filterData, filterConfig, pagination, ...useFilterHelpers(filterData, filterConfig) }
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('submitFilter and the session history', () => {
  const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption[]
  const nav = () => (window as any).navigation

  it('does not push a history entry per submit', () => {
    const types: string[] = []
    const onNavigate = (e: any) => types.push(e.navigationType)
    nav().addEventListener('navigate', onNavigate)
    const indexBefore = nav().currentEntry.index
    const { filterData, pagination, submitFilter, resetFilter } = setup(fields)

    filterData.name = 'a'
    submitFilter(pagination)
    filterData.name = 'b'
    submitFilter(pagination)
    resetFilter(pagination)
    nav().removeEventListener('navigate', onNavigate)

    expect(types).toEqual(['replace', 'replace', 'replace'])
    expect(nav().currentEntry.index).toBe(indexBefore)
  })

  it('does not push one when a visit restores the filter from localStorage either', () => {
    window.history.replaceState(window.history.state, '', location.pathname + location.search)
    localStorage.setItem('tableFilter_sys_visit', 'name=stored~')
    const types: string[] = []
    const onNavigate = (e: any) => types.push(e.navigationType)
    nav().addEventListener('navigate', onNavigate)
    const { pagination, loadStoredFilters } = setup(fields, 'visit')
    loadStoredFilters(pagination)
    nav().removeEventListener('navigate', onNavigate)

    expect(location.hash).toBe('#name=stored~')
    expect(types.filter((t) => t === 'push')).toEqual([])
  })

  it('runs no router navigation, and so none of the app guards, per submit', async () => {
    const history = createWebHistory()
    const router = createRouter({ history, routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
    const guard = vi.fn()
    router.beforeEach(guard)
    await router.push(location.pathname + location.search)
    guard.mockClear()
    const { filterData, pagination, submitFilter } = setup(fields)

    filterData.name = 'x'
    submitFilter(pagination)
    await new Promise((r) => setTimeout(r, 50))

    expect(location.hash).toBe('#name=x&_sort=id,desc~')
    // Admins hang checkForNewVersion / checkRequirements on the global guards.
    expect(guard).not.toHaveBeenCalled()
    history.destroy()
  })
})

describe('restoring values from the hash', () => {
  it('keeps leading-zero codes strings in a multi-value field', () => {
    const fields = [{ name: 'codes', default: [] as string[] }] as const satisfies readonly MakeFilterOption[]
    const { deserializeFilters } = setup(fields)

    expect(deserializeFilters('#codes=007,008~')?.filters.codes).toEqual(['007', '008'])
  })

  // admin-blog UserFilter `phone` (startsWith, type string), admin-inhouse `phoneNumber`, `postcode`.
  it('gives a string field back as the string that was submitted', () => {
    const fields = [
      { name: 'phone', variant: 'startsWith', default: null, type: 'string' },
    ] as const satisfies readonly MakeFilterOption[]
    const first = setup(fields, 'users')
    first.filterData.phone = '0905'
    first.submitFilter(first.pagination)

    // Next visit of the list (remount): the store is rebuilt and filled from hash/localStorage.
    window.location.hash = ''
    const second = setup(fields, 'users')
    second.loadStoredFilters(second.pagination)

    expect(second.filterData.phone).toBe('0905')
  })
})

describe('clearOneFilterSelected with a chip value missing from the data', () => {
  it('leaves the data alone instead of removing its last item', () => {
    const fields = [{ name: 'ids', default: [] as number[] }] as const satisfies readonly MakeFilterOption[]
    const { filterData, filterConfig } = setup(fields)
    filterData.ids = [7, 8]
    // Chip values from the API are strings, the data came back from the hash as numbers.
    const selected = ref(
      new Map<string, ValueObjectOption<string | number>[]>([
        [
          'ids',
          [
            { title: 'A', value: '007' },
            { title: 'B', value: '008' },
          ],
        ],
      ])
    )

    useFilterClearHelpers().clearOneFilterSelected('ids', '007', filterData, filterConfig, selected)

    // splice(-1) used to drop 8 and keep 7, the chip that was closed.
    expect(filterData.ids).toEqual([7, 8])
  })
})

describe('the list entry keeps its hash when the router leaves it', () => {
  const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption[]
  it('comes back with the filter in the url', async () => {
    const history = createWebHistory()
    const router = createRouter({ history, routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
    await router.push(location.pathname + location.search)
    const { filterData, pagination, submitFilter } = setup(fields, 'keep')
    filterData.name = 'x'
    submitFilter(pagination)
    await new Promise((r) => setTimeout(r, 50))
    await router.push({ path: location.pathname, query: { detail: '1' } })

    const back = new Promise((r) => window.addEventListener('popstate', r, { once: true }))
    window.history.back()
    await back
    expect(location.hash).toBe('#name=x&_sort=id,desc~')
    history.destroy()
  })
})
