import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { useSubjectSelect } from '@/domains/subjectSelect/composables/useSubjectSelect'
import { createFilter, createFilterStore } from '@/domains/filters/composables/filterFactory'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { datatablePageKey, useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

// The select dialogs in an editor (related article, bookmarks, redirect) share system/subject with the list
// the editor was opened from. Searching in one wrote page 1 into that list's key, and paging in it wrote its page,
// so Close from the editor reopened the list there instead of where the user left it.

const { setStoredPage, setPreservePage, consumeStoredPage } = useDatatablePageStore()
const listKey = datatablePageKey('s', 'x')

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
})

// Like an admin's select table: it calls `useSubjectSelect` and provides the pagination
// to `ASubjectSelect`, which renders the pager.
const mountDialog = () => {
  let api: ReturnType<typeof useSubjectSelect> | undefined
  const Host = defineComponent({
    setup() {
      const fields = [{ name: 'name' as const, default: '' }]
      const { filterData, filterConfig } = createFilter(fields, createFilterStore(fields), {
        system: 's',
        subject: 'x',
      })
      api = useSubjectSelect(
        [{ key: 'id' }],
        [],
        's',
        'x',
        vi.fn(async () => []),
        filterData,
        filterConfig
      )
      provide(DatatablePaginationKey, api.pagination)
      return () => h(ADatatablePagination)
    },
  })
  wrappers.push(mount(Host))
  if (!api) throw new Error('useSubjectSelect did not run')
  return api
}

describe('useSubjectSelect — the remembered page', () => {
  it('leaves the page of the list sharing its subject alone on a search or a reset', () => {
    setStoredPage(listKey, 3)

    const dialog = mountDialog()
    dialog.submitFilter()
    dialog.resetFilter()
    setPreservePage()

    expect(consumeStoredPage(listKey)).toBe(3)
  })

  it('leaves the page of the list sharing its subject alone when the dialog pages', async () => {
    setStoredPage(listKey, 3)

    const dialog = mountDialog()
    dialog.pagination.value = { ...dialog.pagination.value, totalCount: 500, page: 2 }
    await flushPromises()
    setPreservePage()

    expect(consumeStoredPage(listKey)).toBe(3)
  })
})
