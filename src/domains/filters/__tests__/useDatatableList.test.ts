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
})
