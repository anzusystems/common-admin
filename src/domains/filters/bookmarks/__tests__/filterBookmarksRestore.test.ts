import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { UserAdminConfig } from '@/domains/filters/bookmarks/types/UserAdminConfig'
import {
  DatatablePaginationKey,
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import {
  createFilter,
  createFilterStore,
  type MakeFilterOption,
  useFilterHelpers,
} from '@/domains/filters/composables/filterFactory'
import { usePagination } from '@/domains/api/composables/pagination'

const bookmarks = ref<UserAdminConfig[]>([])

vi.mock('@/domains/filters/bookmarks/api/userAdminConfigApi', () => ({
  useUserAdminConfigApi: () => ({
    useFetchUserAdminConfigList: () => ({ execute: async () => bookmarks.value }),
  }),
}))

const { default: FilterBookmarks } = await import('@/domains/filters/bookmarks/components/FilterBookmarks.vue')

const fields = [
  { name: 'phone' as const, type: 'string', default: null },
  { name: 'id' as const, type: 'integer', default: null },
] satisfies readonly MakeFilterOption[]

describe('FilterBookmarks restoring a bookmark', () => {
  it('keeps a leading-zero code a string and a plain number a number, like the url hash', async () => {
    const { filterConfig, filterData } = createFilter(fields, createFilterStore(fields), {
      system: 'test',
      subject: 'bookmark',
    })
    const { pagination } = usePagination(null)
    const { serializeFilters } = useFilterHelpers(filterData, filterConfig)
    const filter = serializeFilters({ phone: '0905', id: '7' }, pagination, false)
    bookmarks.value = [{ id: 1, customName: 'Saved', data: { filter }, position: 1 } as unknown as UserAdminConfig]

    // The bar fits as many bookmarks as its width allows and moves the rest into a menu: it needs a width.
    const host = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'width: 800px' }))
    const wrapper = mount(FilterBookmarks, {
      attachTo: host,
      props: {
        client: () => ({}) as never,
        userId: 1,
        system: 'test',
        subject: 'bookmark',
        datatableHiddenColumns: undefined,
      },
      global: {
        provide: {
          [FilterConfigKey as symbol]: filterConfig,
          [FilterDataKey as symbol]: filterData,
          [DatatablePaginationKey as symbol]: pagination,
          [FilterSelectedKey as symbol]: ref(new Map()),
        },
      },
    })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Saved'))

    await wrapper
      .findAll('.v-btn')
      .find((b) => b.text().includes('Saved'))!
      .trigger('click')
    await flushPromises()

    expect(filterData.phone).toBe('0905')
    expect(filterData.id).toBe(7)
    wrapper.unmount()
    host.remove()
  })
})
