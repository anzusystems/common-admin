import { createDatatableColumnsConfig, type DatatableOrderingOption } from '@/composables/system/datatableColumns'
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useAlerts } from '@/composables/system/alerts'

export function useSubjectSelect<TItem>(
  datatableConfig: any,
  datatableHiddenColumns: any,
  system: string,
  subject: string,
  fetch: (pag: Pagination, fb: FilterBag) => Promise<Array<TItem>>,
  filter: FilterBag
) {
  const filterTouched: Ref<boolean> = ref(false)
  const items: Ref<Array<TItem>> = ref([])
  const selected: Ref<Array<TItem>> = ref([])
  const loading = ref(false)

  const { resetFilter, submitFilter } = useFilterHelpers()
  const { showErrorsDefault } = useAlerts()

  const { columnsVisible, pagination, updateSortBy, columnsAll, columnsHidden } = createDatatableColumnsConfig(
    datatableConfig,
    datatableHiddenColumns,
    system,
    subject
  )

  const onOpen = () => {
    resetState()
    getList()
  }

  const sortByChange = (option: DatatableOrderingOption) => {
    updateSortBy(option.sortBy)
    getList()
  }

  const onFetchNextPage = async () => {
    loading.value = true
    pagination.page++
    try {
      items.value.push(...(await fetch(pagination, filter)))
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      loading.value = false
    }
  }

  const resetState = () => {
    items.value = []
    selected.value = []
  }

  const getList = async () => {
    loading.value = true
    try {
      items.value = await fetch(pagination, filter)
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      loading.value = false
    }
  }

  const onRowClick = (event: Event) => {
    const eventTarget = event.target as HTMLElement | null
    if (!eventTarget || (eventTarget.tagName === 'INPUT' && (eventTarget as HTMLInputElement).type === 'checkbox')) {
      return
    }
    const parent = eventTarget.closest('.v-data-table__tr')
    if (!parent || !parent.classList.contains('v-data-table__tr')) return
    const firstTd = parent.firstElementChild
    if (!firstTd || !firstTd.classList.contains('v-data-table__td')) return
    const input = firstTd.querySelector('input')
    if (!input) return
    input.click()
  }

  return {
    items,
    selected,
    pagination,
    columnsVisible,
    columnsHidden,
    columnsAll,
    filterTouched,
    loading,
    onRowClick,
    onFetchNextPage,
    onOpen,
    sortByChange,
    getList,
    resetFilter: () => resetFilter(filter, pagination, getList),
    submitFilter: () => submitFilter(filter, pagination, getList),
  }
}
