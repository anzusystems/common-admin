import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, inject } from 'vue'
import {
  createFilter,
  createFilterStore,
  useDatatableList,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { usePagination, type Pagination } from '@/domains/api/composables/pagination'
import type { Ref } from 'vue'

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]

const debounced = () => new Promise((resolve) => setTimeout(resolve, 260))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  window.location.hash = ''
})

const mountList = (moreOptions: Record<string, unknown> = {}, loaded?: () => Promise<void>) => {
  const fetches: Array<{ name: unknown; page: number }> = []
  const injected: { config?: FilterConfig; data?: FilterData; pagination?: Ref<Pagination> } = {}
  let list: ReturnType<typeof useDatatableList> | undefined
  let own: { filterData: FilterData; filterConfig: FilterConfig; pagination: Ref<Pagination> } | undefined
  const FilterBar = defineComponent(() => {
    injected.config = inject(FilterConfigKey)
    injected.data = inject(FilterDataKey)
    injected.pagination = inject(DatatablePaginationKey)
    return () => null
  })
  wrapper = mount(
    defineComponent(() => {
      const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
        system: 'sys',
        subject: 'list',
      })
      const { pagination } = usePagination('id')
      own = { filterData, filterConfig, pagination }
      list = useDatatableList(
        filterData,
        filterConfig,
        pagination,
        (p, data) => {
          fetches.push({ name: data.name, page: p.value.page })
          return loaded?.()
        },
        moreOptions
      )
      return () => h(FilterBar)
    })
  )
  return { fetches, injected, list: list!, own: own! }
}

describe('useDatatableList', () => {
  it('provides the filter and the pagination to the components below it', () => {
    const { injected, own } = mountList()
    expect(injected.config).toBe(own.filterConfig)
    expect(injected.data).toBe(own.filterData)
    expect(injected.pagination).toBe(own.pagination)
  })

  it('loads the first page once on mount, with the filter stored in the address', async () => {
    window.location.hash = '#name=abc&_sort=id%2Cdesc~'
    const { fetches } = mountList()
    await debounced()
    expect(fetches).toEqual([{ name: 'abc', page: 1 }])
  })

  it('submits and resets through the filter helpers, each a debounced load', async () => {
    const { fetches, list, own } = mountList()
    await debounced()
    own.filterData.name = 'xyz'
    list.submitFilterAction()
    await debounced()
    expect(fetches.at(-1)).toEqual({ name: 'xyz', page: 1 })

    expect(window.location.hash).toContain('name=xyz')
    own.pagination.value = { ...own.pagination.value, page: 3 }
    const before = fetches.length
    list.resetFilterAction()
    await debounced()
    expect(window.location.hash).toBe('')
    expect(fetches.length).toBe(before + 1)
    expect(fetches.at(-1)?.page).toBe(1)
    expect(list.sortByChange).toBe(list.submitFilterAction)
  })

  it('passes its options to the filter helpers: no address written when told so', async () => {
    const { list, own } = mountList({ populateUrlParams: false, storeFiltersLocalStorage: false })
    await debounced()
    own.filterData.name = 'xyz'
    list.submitFilterAction()
    await debounced()
    expect(window.location.hash).toBe('')
    expect(localStorage.length).toBe(0)
  })

  it('debounces calls close together into one load', async () => {
    const { fetches, list } = mountList()
    await debounced()
    const before = fetches.length
    list.getList()
    list.getList()
    list.getList()
    await debounced()
    expect(fetches.length).toBe(before + 1)
  })

  it('resolves getList when the list has loaded, not when the debounce fires', async () => {
    let finish = () => {}
    const { list } = mountList(
      {},
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    await debounced()
    let done = false
    const call = list.getList().then(() => {
      done = true
    })
    await debounced()
    expect(done).toBe(false)
    finish()
    await call
    expect(done).toBe(true)
  })

  // "Zrušiť filter" cleared the sort from the address and local storage but left it on the screen and in the
  // request, so a reload, Close or the menu showed another order than the one just shown (#87746).
  describe('reset', () => {
    const ascending = { key: 'id', order: 'asc' } as const
    const listDefault = { key: 'id', order: 'desc' } as const

    it('puts the sort back to the default of the list, as the address and the storage have it', async () => {
      const { list, own } = mountList()
      await debounced()
      own.pagination.value = { ...own.pagination.value, sortBy: { ...ascending } }
      list.sortByChange()
      await debounced()
      expect(window.location.hash).toContain('_sort=id,asc')
      expect(localStorage.getItem('tableFilter_sys_list')).toContain('_sort=id,asc')

      list.resetFilterAction()
      await debounced()

      expect(own.pagination.value.sortBy).toEqual(listDefault)
      expect(window.location.hash).toBe('')
      expect(localStorage.getItem('tableFilter_sys_list')).toBeNull()
    })

    it('takes the default the list was set up with, not the sort a link opened it with', async () => {
      window.location.hash = '#_sort=id,asc~'
      const { list, own } = mountList()
      await debounced()
      expect(own.pagination.value.sortBy).toEqual(ascending)

      list.resetFilterAction()
      await debounced()

      expect(own.pagination.value.sortBy).toEqual(listDefault)
    })

    // Nothing is kept there, so the screen and a reload cannot disagree.
    it('leaves the sort of a list that keeps no view alone', async () => {
      const { list, own } = mountList({ populateUrlParams: false, storeFiltersLocalStorage: false })
      await debounced()
      own.pagination.value = { ...own.pagination.value, sortBy: { ...ascending } }
      list.sortByChange()
      await debounced()

      list.resetFilterAction()
      await debounced()

      expect(own.pagination.value.sortBy).toEqual(ascending)
    })
  })
})
