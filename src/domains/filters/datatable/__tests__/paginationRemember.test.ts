import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { DatatablePageStoreKey, DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { usePagination } from '@/domains/api/composables/pagination'
import type { Pagination } from '@/domains/api/composables/pagination'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

// A restore after Close sets the page and the rows per page together. A separate rows-per-page
// watcher took that for the toggle and put the page back to 1, so the user lost the page again.

const KEY = 'test_paginationRemember'
const { consumeStoredPage, getStoredRowsPerPage, setPreservePage } = useDatatablePageStore()

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
})

const mountPagination = (over: Partial<Pagination> = {}) => {
  const { pagination } = usePagination('id')
  pagination.value = { ...pagination.value, totalCount: 500, ...over }
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(ADatatablePagination),
    }),
    {
      global: {
        provide: { [DatatablePaginationKey as symbol]: pagination, [DatatablePageStoreKey as symbol]: KEY },
      },
    }
  )
  wrappers.push(wrapper)
  return { pagination, pager: wrapper.findComponent(ADatatablePagination) }
}

const stored = () => {
  setPreservePage()
  return { page: consumeStoredPage(KEY), rowsPerPage: getStoredRowsPerPage(KEY) }
}

describe('what the paginator remembers', () => {
  it('keeps a page restored together with its rows per page', async () => {
    const { pagination, pager } = mountPagination()
    pagination.value = { ...pagination.value, page: 3, rowsPerPage: 10 }
    await flushPromises()

    expect(pagination.value).toMatchObject({ page: 3, rowsPerPage: 10 })
    expect(pager.emitted('change')).toHaveLength(1)
    expect(stored()).toEqual({ page: 3, rowsPerPage: 10 })
  })

  it('starts on page 1 when only the rows per page change', async () => {
    const { pagination, pager } = mountPagination({ page: 3 })
    pagination.value.rowsPerPage = 10
    await flushPromises()

    expect(pagination.value.page).toBe(1)
    expect(pager.emitted('change')).toHaveLength(1)
    expect(stored()).toEqual({ page: 1, rowsPerPage: 10 })
  })

  it('stores a page change with the current rows per page', async () => {
    const { pagination, pager } = mountPagination()
    pagination.value.page = 2
    await flushPromises()

    expect(pager.emitted('change')).toHaveLength(1)
    expect(stored()).toEqual({ page: 2, rowsPerPage: 25 })
  })
})
