import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ADatatableOrdering from '@/domains/filters/datatable/components/ADatatableOrdering.vue'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { usePagination } from '@/domains/api/composables/pagination'
import { SORT_BY_SCORE, type DatatableOrderingOptions } from '@/domains/filters/datatable/utils/datatableColumns'
import { SortOrder, type SortOrderType } from '@/domains/api/types/SortOrder'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
})

const mountOrdering = (
  props: Record<string, unknown> = {},
  sortKey: string | null = 'id',
  order: SortOrderType = SortOrder.Desc
) => {
  const { pagination } = usePagination(sortKey, order)
  const wrapper = mount(ADatatableOrdering, {
    props,
    attachTo: document.body,
    global: { provide: { [DatatablePaginationKey as symbol]: pagination } },
  })
  wrappers.push(wrapper)
  return { wrapper, pagination }
}

const openMenu = async (wrapper: VueWrapper) => {
  // The activator is bound after mount; a click before that opens nothing.
  await flushPromises()
  ;(wrapper.find('.v-btn').element as HTMLElement).click()
  await vi.waitFor(() => {
    if (!document.querySelector('.v-list-item')) throw new Error('menu not open')
  })
}

const pick = async (wrapper: VueWrapper, title: string) => {
  await openMenu(wrapper)
  const item = Array.from(document.querySelectorAll('.v-list-item')).find((el) => el.textContent?.trim() === title)
  if (!item) throw new Error(`No option "${title}"`)
  ;(item as HTMLElement).click()
  await flushPromises()
}

describe('ADatatableOrdering', () => {
  it('refuses to mount without a pagination', () => {
    expect(() => mount(ADatatableOrdering)).toThrow('Incorrect provide/inject config.')
  })

  it('shows the option matching the pagination', () => {
    const { wrapper } = mountOrdering()
    expect(wrapper.text()).toContain('Most recent')
  })

  it('selects the option matching a pagination sorted the other way', () => {
    const { wrapper } = mountOrdering({}, 'id', SortOrder.Asc)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  it('writes the picked option into the pagination and emits it', async () => {
    const { wrapper, pagination } = mountOrdering()
    await pick(wrapper, 'Oldest')
    expect(pagination.value.sortBy).toEqual({ key: 'id', order: SortOrder.Asc })
    expect(wrapper.emitted('sortByChange')?.[0]?.[0]).toMatchObject({ id: 2 })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  it('sorts by createdAt in the createdAt variant', async () => {
    const { wrapper, pagination } = mountOrdering({ variant: 'createdAt' }, 'createdAt')
    await pick(wrapper, 'Oldest')
    expect(pagination.value.sortBy).toEqual({ key: 'createdAt', order: SortOrder.Asc })
  })

  it('offers relevance first in the most-relevant variant', async () => {
    const { wrapper, pagination } = mountOrdering({ variant: 'most-relevant', modelValue: 1 }, 'createdAt')
    await openMenu(wrapper)
    const titles = Array.from(document.querySelectorAll('.v-list-item')).map((el) => el.textContent?.trim())
    expect(titles).toEqual(['Most relevant', 'Most recent', 'Oldest'])
    ;(document.querySelector('.v-list-item') as HTMLElement).click()
    await flushPromises()
    expect(pagination.value.sortBy).toEqual({ key: SORT_BY_SCORE, order: SortOrder.Desc })
  })

  it('hands the choice to a custom callback instead', async () => {
    const cb = vi.fn()
    const { wrapper, pagination } = mountOrdering({ paginationUpdateCustomCb: cb })
    await pick(wrapper, 'Oldest')
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), pagination)
    expect(pagination.value.sortBy).toEqual({ key: 'id', order: SortOrder.Desc })
  })

  it('clears the sort for a custom option without one', async () => {
    const customOptions: DatatableOrderingOptions = [
      { id: 1, titleT: 'common.system.datatable.ordering.mostRecent', sortBy: { key: 'id', order: SortOrder.Desc } },
      { id: 5, titleT: 'common.system.datatable.ordering.mostRelevant', sortBy: null as never },
    ]
    const { wrapper, pagination } = mountOrdering({ customOptions })
    await pick(wrapper, 'Most relevant')
    expect(pagination.value.sortBy).toBeNull()
    expect(wrapper.emitted('sortByChange')?.[0]?.[0]).toMatchObject({ id: 5 })
  })

  it('follows a pagination replaced from outside (setSortBy, a loaded hash)', async () => {
    const { wrapper, pagination } = mountOrdering()
    pagination.value = { ...pagination.value, sortBy: { key: 'id', order: SortOrder.Asc } }
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  // The admins set `pagination.value.sortBy = ...` in place (cms DashboardStageDatatable's reset,
  // personPositionSelectActions) and then have to reset the ordering's v-model by hand, because
  // the watch is shallow and never sees it.
  it('follows a sortBy changed in place', async () => {
    const { wrapper, pagination } = mountOrdering()
    pagination.value.sortBy = { key: 'id', order: SortOrder.Asc }
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  it('shows nothing for a sort no option matches', () => {
    const { wrapper } = mountOrdering({ modelValue: 99 }, 'title')
    expect(wrapper.find('.v-btn').text()).toBe('')
  })

  it('keeps a pagination whose sort no option matches', async () => {
    const { pagination } = mountOrdering({}, 'title', SortOrder.Asc)
    await nextTick()
    expect(pagination.value.sortBy).toEqual({ key: 'title', order: SortOrder.Asc })
  })
})
