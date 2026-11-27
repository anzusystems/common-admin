import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  createFilter,
  createFilterStore,
  type FilterData,
  useDatatableList,
  useFilterHelpers,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { usePagination } from '@/domains/api/composables/pagination'
import { useApiQueryBuilder } from '@/domains/api/composables/useApiQueryBuilder'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

// admin-cms links a photo's usages to its image list by a hidden filter field (`#damGroupId=<uuid>&_sort=id,desc~`).
// The list saved a view loaded from a hash to local storage, so a later visit through the menu brought the field
// back and silently showed one photo. A field with `persist: false` lives in the address only.

const GROUP = '0b1f6c1e-aaaa-4bbb-8ccc-0123456789ab'
const OLD_GROUP = '9d3e2a10-dddd-4eee-8fff-ba9876543210'
const fields = [
  { name: 'groupId', default: null, type: 'string', render: { skip: true }, persist: false },
  { name: 'source', variant: 'startsWith', default: null, type: 'string' },
] as const satisfies readonly MakeFilterOption[]
const STORAGE_KEY = 'tableFilter_sys_images'
const PAGE_STORE_KEY = 'sys_images'

// One filter store for all visits, as an admin keeps it at module level.
let store: FilterData<typeof fields>
const visit = () => {
  const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'images' })
  const { pagination } = usePagination('id')
  return { filterData, filterConfig, pagination, ...useFilterHelpers(filterData, filterConfig) }
}

const apiQuery = (visited: ReturnType<typeof visit>) => {
  const { querySetFilters, queryBuild } = useApiQueryBuilder()
  querySetFilters(visited.filterData, visited.filterConfig)
  return queryBuild()
}

let wrapper: VueWrapper | undefined
beforeEach(() => {
  store = createFilterStore(fields)
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

describe('a filter field kept in the address only (persist: false)', () => {
  it('applies from a link, goes into the API query and stays in the address, but not into local storage', () => {
    window.location.hash = `#groupId=${GROUP}&source=Reuters&_sort=id,desc~`
    const list = visit()

    expect(list.loadStoredFilters(list.pagination)).toBe(true)
    expect(list.filterData.groupId).toBe(GROUP)
    expect(list.filterData.source).toBe('Reuters')
    expect(apiQuery(list)).toBe(`?filter_eq[groupId]=${GROUP}&filter_startsWith[source]=Reuters`)
    expect(window.location.hash).toBe(`#groupId=${GROUP}&source=Reuters&_sort=id,desc~`)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('source=Reuters&_sort=id,desc~')
  })

  it('is not saved by a submit, which keeps it in the address', () => {
    const list = visit()
    list.loadStoredFilters(list.pagination)

    list.filterData.groupId = GROUP
    list.filterData.source = 'TASR'
    list.submitFilter(list.pagination)

    expect(window.location.hash).toBe(`#groupId=${GROUP}&source=TASR&_sort=id,desc~`)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('source=TASR&_sort=id,desc~')
  })

  it('does not come back through the menu (no hash), while the other fields do', () => {
    window.location.hash = `#groupId=${GROUP}&source=Reuters&_sort=id,asc~`
    const linked = visit()
    linked.loadStoredFilters(linked.pagination)

    window.location.hash = ''
    const again = visit()
    expect(again.loadStoredFilters(again.pagination)).toBe(true)

    // The filter store still held it from the link.
    expect(again.filterData.groupId).toBeNull()
    expect(again.filterData.source).toBe('Reuters')
    expect(again.pagination.value.sortBy).toEqual({ key: 'id', order: 'asc' })
    expect(apiQuery(again)).toBe('?filter_startsWith[source]=Reuters')
    expect(window.location.hash).toBe('#source=Reuters&_sort=id,asc~')
  })

  it('is not restored from a view saved before it was kept out, which is not put into the address either', () => {
    localStorage.setItem(STORAGE_KEY, `groupId=${OLD_GROUP}&source=Reuters&_sort=id,asc~`)
    const list = visit()

    expect(list.loadStoredFilters(list.pagination)).toBe(true)
    expect(list.filterData.groupId).toBeNull()
    expect(list.filterData.source).toBe('Reuters')
    expect(list.pagination.value.sortBy).toEqual({ key: 'id', order: 'asc' })
    expect(window.location.hash).toBe('#source=Reuters&_sort=id,asc~')
  })

  it('restores nothing from a saved view that held only it', () => {
    localStorage.setItem(STORAGE_KEY, `groupId=${OLD_GROUP}~`)
    const list = visit()

    expect(list.loadStoredFilters(list.pagination)).toBe(false)
    expect(list.filterData.groupId).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('goes back to its default with nothing stored at all, also when the store held it', () => {
    store.groupId = GROUP
    const list = visit()

    expect(list.loadStoredFilters(list.pagination)).toBe(false)
    expect(list.filterData.groupId).toBeNull()
  })

  it('a link that names another field does not bring it back from the store either', () => {
    store.groupId = GROUP
    window.location.hash = '#source=AP~'
    const list = visit()

    list.loadStoredFilters(list.pagination)
    expect(list.filterData.groupId).toBeNull()
    expect(list.filterData.source).toBe('AP')
  })

  it('goes into a bookmark, which the user saves on purpose', () => {
    const list = visit()
    list.filterData.groupId = GROUP
    list.filterData.source = 'AP'

    // As `FilterBookmarkDialog` saves and `FilterBookmarks` reads a bookmark.
    const bookmark = list.serializeFilters(list.filterData, list.pagination, false)
    expect(bookmark).toBe(`groupId=${GROUP}&source=AP~`)
    expect(list.deserializeFilters(bookmark)?.filters).toEqual({ groupId: GROUP, source: 'AP' })
  })

  const mountList = () => {
    let pagination: ReturnType<typeof usePagination>['pagination'] | undefined
    wrapper = mount(
      defineComponent(() => {
        const { filterData, filterConfig } = createFilter(fields, store, { system: 'sys', subject: 'images' })
        pagination = usePagination('id').pagination
        pagination.value = { ...pagination.value, totalCount: 500 }
        useDatatableList(filterData, filterConfig, pagination, () => undefined)
        return () => h(ADatatablePagination)
      })
    )
    return pagination!
  }

  // The page belongs to the view with the field. Saved beside the view without it, the menu opened the whole
  // list (or the saved filter) on the page the picker's link was left at.
  it('keeps its page out of local storage too, which holds the view without it, and in the address', async () => {
    window.location.hash = `#groupId=${GROUP}&source=AP&_sort=id,desc~`
    const pagination = mountList()
    await flushPromises()

    pagination.value.page = 3
    await flushPromises()
    expect(window.location.hash).toBe(`#groupId=${GROUP}&source=AP&_sort=id,desc&_page=3&_limit=25~`)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('source=AP&_sort=id,desc~')

    wrapper!.unmount()
    window.location.hash = ''
    const again = mountList()
    await flushPromises()
    expect(again.value.page).toBe(1)
    expect(window.location.hash).toBe('#source=AP&_sort=id,desc~')
  })

  it('keeps the page of a reloaded link with it out of the view it saves', () => {
    window.location.hash = `#groupId=${GROUP}&source=AP&_sort=id,desc&_page=2&_limit=25~`
    const list = visit()

    list.loadStoredFilters(list.pagination)
    expect(list.pagination.value.page).toBe(2)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('source=AP&_sort=id,desc~')
  })
})

describe('the other fields and lists', () => {
  const plain = [
    { name: 'groupId', default: null, type: 'string', render: { skip: true } },
    { name: 'source', variant: 'startsWith', default: null, type: 'string' },
  ] as const satisfies readonly MakeFilterOption[]

  it('a field without the option is saved and restored as before', () => {
    window.location.hash = `#groupId=${GROUP}&source=AP~`
    const shared = createFilterStore(plain)
    const first = createFilter(plain, shared, { system: 'sys', subject: 'plain' })
    const firstHelpers = useFilterHelpers(first.filterData, first.filterConfig)
    firstHelpers.loadStoredFilters(usePagination('id').pagination)
    expect(localStorage.getItem('tableFilter_sys_plain')).toBe(`groupId=${GROUP}&source=AP&_sort=id,desc~`)

    window.location.hash = ''
    localStorage.setItem('tableFilter_sys_plain', `groupId=${OLD_GROUP}&source=AP~`)
    const second = createFilter(plain, createFilterStore(plain), { system: 'sys', subject: 'plain' })
    useFilterHelpers(second.filterData, second.filterConfig).loadStoredFilters(usePagination('id').pagination)
    expect(second.filterData.groupId).toBe(OLD_GROUP)
    expect(window.location.hash).toBe(`#groupId=${OLD_GROUP}&source=AP~`)
  })

  it('resolves the option to persisting when left out', () => {
    const { filterConfig } = visit()

    expect(filterConfig.fields.groupId.persist).toBe(false)
    expect(filterConfig.fields.source.persist).toBe(true)
  })
})
