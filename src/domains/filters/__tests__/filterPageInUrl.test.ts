import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import {
  createFilter,
  createFilterStore,
  useDatatableList,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { usePagination } from '@/domains/api/composables/pagination'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

// The page was kept only for Close. A reload, a link, a new tab, Back or a return through the menu
// opened the list on page 1. The page now goes into the address and local storage with the filter and sort.

const fields = [{ name: 'name', default: '' }] as const satisfies readonly MakeFilterOption<string>[]
const STORAGE_KEY = 'tableFilter_sys_pageUrl'
const PAGE_STORE_KEY = 'sys_pageUrl'

const setup = () => {
  const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
    system: 'sys',
    subject: 'pageUrl',
  })
  const { pagination } = usePagination('id')
  return { filterData, pagination, ...useFilterHelpers(filterData, filterConfig) }
}

let wrapper: VueWrapper | undefined
beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
  useDatatablePageStore().setStoredPage(PAGE_STORE_KEY, 1, undefined, null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  window.location.hash = ''
  vi.restoreAllMocks()
})

describe('the page in a stored view', () => {
  it('reads the page with its rows per page', () => {
    const { deserializeFilters } = setup()

    expect(deserializeFilters('#name=abc&_sort=id,desc&_page=3&_limit=10~')).toEqual({
      filters: { name: 'abc' },
      sortBy: { key: 'id', order: 'desc' },
      page: 3,
      rowsPerPage: 10,
    })
    expect(deserializeFilters('#_page=2&_limit=25~')).toEqual({ filters: {}, sortBy: null, page: 2, rowsPerPage: 25 })
  })

  it.each(['_page=0&_limit=10', '_page=abc&_limit=10', '_page=-2&_limit=10', '_page=2', '_page=2&_limit=1000'])(
    'ignores the unusable page in %s',
    (params) => {
      const { deserializeFilters } = setup()

      expect(deserializeFilters(`#name=abc&${params}~`)).toEqual({ filters: { name: 'abc' }, sortBy: null })
      expect(deserializeFilters(`#${params}~`)).toBeNull()
    }
  )

  it('writes the page only past the first one', () => {
    const { serializeFilters, pagination } = setup()

    expect(serializeFilters({ name: 'abc' }, pagination, true, true)).toBe('name=abc&_sort=id,desc~')
    pagination.value = { ...pagination.value, page: 4, rowsPerPage: 10 }
    expect(serializeFilters({ name: 'abc' }, pagination, true, true)).toBe('name=abc&_sort=id,desc&_page=4&_limit=10~')
    expect(serializeFilters({ name: 'abc' }, pagination, true)).toBe('name=abc&_sort=id,desc~')
  })
})

describe('loadStoredFilters with a page', () => {
  it('opens a link on the page it names', () => {
    const { filterData, pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc&_sort=id,desc&_page=3&_limit=10~'

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('abc')
    expect(pagination.value).toMatchObject({ page: 3, rowsPerPage: 10 })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('name=abc&_sort=id,desc&_page=3&_limit=10~')
  })

  it('takes a page-only hash without resetting the filter', () => {
    const { filterData, pagination, loadStoredFilters } = setup()
    filterData.name = 'kept'
    window.location.hash = '#_page=2&_limit=25~'

    expect(loadStoredFilters(pagination)).toBe(true)
    expect(filterData.name).toBe('kept')
    expect(pagination.value.page).toBe(2)
  })

  it('comes back through the menu (no hash) on the page local storage kept', () => {
    localStorage.setItem(STORAGE_KEY, 'name=abc&_sort=id,desc&_page=5&_limit=50~')
    const { pagination, loadStoredFilters } = setup()

    loadStoredFilters(pagination)
    expect(pagination.value).toMatchObject({ page: 5, rowsPerPage: 50 })
    expect(window.location.hash).toBe('#name=abc&_sort=id,desc&_page=5&_limit=50~')
  })

  it('still starts a link without a page on the first page', () => {
    const { pagination, loadStoredFilters } = setup()
    pagination.value = { ...pagination.value, page: 4 }
    window.location.hash = '#name=abc~'

    loadStoredFilters(pagination)
    expect(pagination.value.page).toBe(1)
  })

  it('lets the page Close kept win', () => {
    const { setStoredPage, setPreservePage } = useDatatablePageStore()
    setStoredPage(PAGE_STORE_KEY, 4, 25)
    setPreservePage()
    const { pagination, loadStoredFilters } = setup()
    window.location.hash = '#name=abc&_page=2&_limit=10~'

    loadStoredFilters(pagination)
    expect(pagination.value).toMatchObject({ page: 4, rowsPerPage: 25 })
  })

  it('drops the page on a submit, as a new filter starts on the first page', () => {
    const { filterData, pagination, loadStoredFilters, submitFilter } = setup()
    window.location.hash = '#name=abc&_page=3&_limit=10~'
    loadStoredFilters(pagination)

    filterData.name = 'xyz'
    submitFilter(pagination)
    expect(pagination.value.page).toBe(1)
    expect(window.location.hash).toBe('#name=xyz&_sort=id,desc~')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('name=xyz&_sort=id,desc~')
  })
})

describe('a page change in the pager', () => {
  const mountList = (options: Record<string, unknown> = {}) => {
    const fetched: number[] = []
    let own:
      | { pagination: ReturnType<typeof usePagination>['pagination']; list: ReturnType<typeof useDatatableList> }
      | undefined
    let dialog: ReturnType<typeof usePagination>['pagination'] | undefined
    const Dialog = defineComponent(() => {
      dialog = usePagination('id').pagination
      dialog.value = { ...dialog.value, totalCount: 500 }
      provide(DatatablePaginationKey, dialog)
      return () => h(ADatatablePagination)
    })
    wrapper = mount(
      defineComponent(() => {
        const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
          system: 'sys',
          subject: 'pageUrl',
        })
        const { pagination } = usePagination('id')
        pagination.value = { ...pagination.value, totalCount: 500 }
        const list = useDatatableList(
          filterData,
          filterConfig,
          pagination,
          (p) => void fetched.push(p.value.page),
          options
        )
        own = { pagination, list }
        return () => h('div', [h(ADatatablePagination), h(Dialog)])
      })
    )
    return { fetched, pagination: own!.pagination, list: own!.list, dialog: dialog! }
  }

  it('goes into the address and local storage, and back out on page 1', async () => {
    const { pagination } = mountList()
    await flushPromises()

    pagination.value.page = 3
    await flushPromises()
    expect(window.location.hash).toBe('#_sort=id,desc&_page=3&_limit=25~')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('_sort=id,desc&_page=3&_limit=25~')

    pagination.value.page = 1
    await flushPromises()
    expect(window.location.hash).toBe('#_sort=id,desc~')
  })

  it('leaves the address a reset emptied empty', async () => {
    const { pagination, list } = mountList()
    await flushPromises()
    pagination.value.page = 2
    await flushPromises()

    list.resetFilterAction()
    await flushPromises()
    expect(pagination.value.page).toBe(1)
    expect(window.location.hash).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('stays out of the address of a list that keeps none', async () => {
    const { pagination } = mountList({ populateUrlParams: false, storeFiltersLocalStorage: false })
    await flushPromises()

    pagination.value.page = 3
    await flushPromises()
    expect(window.location.hash).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('of another pagination below the list does not write the list address', async () => {
    const { dialog } = mountList()
    await flushPromises()

    dialog.value.page = 2
    await flushPromises()
    expect(window.location.hash).not.toContain('_page')
  })
})
