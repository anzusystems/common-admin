import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ADatatablePagination from '@/labs/filters/ADatatablePagination.vue'
import ASubjectSelect from '@/labs/subjectSelect/ASubjectSelect.vue'
import { DatatablePaginationKey } from '@/labs/filters/filterInjectionKeys'
import { usePagination } from '@/labs/filters/pagination'
import type { Pagination } from '@/labs/filters/pagination'

// What the paginator makes of an empty list, asserted on the rendered buttons rather than on the
// expression -- the bug this pins was not in what the api wrote but in what the component made of it,
// and a test that recomputed the expression itself would have agreed with the bug.
//
// An empty counted list has `totalCount: 0`, so `lastPage` is 0 while `page` is never below 1: with
// `===` the two could never meet, and every empty list counted as "not on the last page". Next and
// Last stayed live on a page with nothing in it. It is the same state a list is in before the first
// request, so it was the first thing a user could see.

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

  // And the cases that have to keep working.
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

// The same reading, in the component that acts on it by itself. `ASubjectSelect` does not disable a
// button -- it decides whether to load more, and shows the control that triggers it. On an empty list
// it used to show that control and satisfy its own autoload condition, so the loading never stopped
// starting. It is a dialog, so its content is teleported and has to be read off the document.
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

  // The control itself, not a `button` element: `ABtnSecondary` is not registered in this mount, so
  // it stays an unresolved element -- which is where `v-show` puts its flag either way.
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
