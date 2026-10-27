import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import ASubjectSelect from '@/domains/subjectSelect/components/ASubjectSelect.vue'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { usePagination } from '@/domains/api/composables/pagination'
import type { Pagination } from '@/domains/api/composables/pagination'

// Asserts on the rendered buttons, not the expression: a test that recomputed the expression would agree with the bug.
// An empty counted list has `totalCount: 0`, so `lastPage` is 0 while `page` is never below 1.
// With `===` they never met, so Next and Last stayed live on an empty page.
// The same state occurs before the first request.

const mountPagination = (over: Partial<Pagination> = {}) => {
  const { pagination } = usePagination('id')
  pagination.value = { ...pagination.value, ...over }

  const wrapper = mount(
    defineComponent({
      setup: () => () => h(ADatatablePagination),
    }),
    { global: { provide: { [DatatablePaginationKey as symbol]: pagination } } }
  )

  const buttons = wrapper.findAll('.anzu-data-footer__icons-after button')

  return { next: buttons[0], last: buttons[1], pagination }
}

describe('what the paginator offers on an empty list', () => {
  it('offers neither next nor last before anything has been asked for', () => {
    const { next, last } = mountPagination()

    expect(next?.attributes('disabled')).toBeDefined()
    expect(last?.attributes('disabled')).toBeDefined()
  })

  it('offers neither on an empty counted answer', () => {
    const { next, last } = mountPagination({ hasNextPage: null, totalCount: 0, page: 1 })

    expect(next?.attributes('disabled')).toBeDefined()
    expect(last?.attributes('disabled')).toBeDefined()
  })

  it('offers the next page where there is one', () => {
    const { next, last } = mountPagination({ hasNextPage: null, totalCount: 100, rowsPerPage: 25, page: 1 })

    expect(next?.attributes('disabled')).toBeUndefined()
    expect(last?.attributes('disabled')).toBeUndefined()
  })

  it('stops on the last page of a counted list', () => {
    const { next } = mountPagination({ hasNextPage: null, totalCount: 100, rowsPerPage: 25, page: 4 })

    expect(next?.attributes('disabled')).toBeDefined()
  })

  it('follows the marker on an infinite list', () => {
    const more = mountPagination({ hasNextPage: true, totalCount: 0, page: 1 })
    const ended = mountPagination({ hasNextPage: false, totalCount: 0, page: 3 })

    expect(more.next?.attributes('disabled')).toBeUndefined()
    expect(ended.next?.attributes('disabled')).toBeDefined()
  })

  // An infinite list never offers Last, whatever page it is on: there is no last page to go to.
  it('never offers last on an infinite list', () => {
    const { last } = mountPagination({ hasNextPage: true, totalCount: 0, page: 1 })

    expect(last?.attributes('disabled')).toBeDefined()
  })
})

// Same check in the component that acts on it by itself.
// `ASubjectSelect` decides whether to load more. On an empty list it showed the
// load control and met its own autoload condition, so loading never stopped.
// It is a dialog, so its content is teleported and must be read off the document.
const mountSubjectSelect = async (over: Partial<Pagination> = {}) => {
  const { pagination } = usePagination('id')

  mount(ASubjectSelect as unknown as Parameters<typeof mount>[0], {
    attachTo: document.body,
    props: {
      selectedItems: [],
      pagination: { ...pagination.value, ...over },
      modelValue: true,
      paginationMode: 'more',
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 20))

  // The control's root element, where `v-show` puts its flag.
  return document.body.querySelector('.justify-center.pa-4 > *') as HTMLElement | null
}

const offersMore = (control: HTMLElement | null) => control !== null && control.style.display !== 'none'

describe('what the subject select makes of an empty list', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not offer to load more when there is nothing', async () => {
    expect(offersMore(await mountSubjectSelect({ hasNextPage: null, totalCount: 0, page: 1 }))).toBe(false)
  })

  it('offers to load more when the answer said there is more', async () => {
    expect(offersMore(await mountSubjectSelect({ hasNextPage: true, totalCount: 0, page: 1 }))).toBe(true)
  })

  it('offers to load more on a counted list with pages to go', async () => {
    expect(offersMore(await mountSubjectSelect({ hasNextPage: null, totalCount: 100, rowsPerPage: 25, page: 1 }))).toBe(
      true
    )
  })
})
