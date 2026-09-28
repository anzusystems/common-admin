import { type DatatableOrderingOption, type DatatableSortBy } from '@/domains/filters/datatable/utils/datatableColumns'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { type FilterConfig, type FilterData, useFilterHelpers } from '@/domains/filters/composables/filterFactory'
import { createDatatableColumnsConfig } from '@/domains/filters/datatable/composables/createDatatableColumnsConfig'
import { type Pagination, usePagination } from '@/domains/api/composables/pagination'
import type { FetchListParams } from '@/domains/api/composables/useApiFetchList'
import { useDebounceFn } from '@vueuse/core'
import { isNull } from '@/shared/utils/common'

export function useSubjectSelect<TItem>(
  datatableConfig: any,
  datatableHiddenColumns: any,
  system: string,
  subject: string,
  execute: (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    params?: FetchListParams
  ) => Promise<TItem[]>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>,
  filterSortBy: DatatableSortBy | null = null,
  fetchParams: FetchListParams | undefined = undefined,
  enableActions: boolean = false
) {
  const filterTouched: Ref<boolean> = ref(false)
  const items: Ref<Array<TItem>> = ref([])
  const selected: Ref<Array<TItem>> = ref([])
  const loading = ref(false)
  const { pagination, setSortBy, incrementPage } = usePagination(
    isNull(filterSortBy) ? null : filterSortBy.key,
    filterSortBy?.order
  )

  const { resetFilter, submitFilter } = useFilterHelpers(filterData, filterConfig, {
    storeFiltersLocalStorage: false,
    populateUrlParams: false,
  })
  const { showErrorsDefault } = useAlerts()

  const { columnsVisible, columnsAll, columnsHidden } = createDatatableColumnsConfig(
    datatableConfig,
    datatableHiddenColumns,
    system,
    subject,
    { storeColumnsLocalStorage: false, disableActions: !enableActions }
  )

  const onOpen = () => {
    resetState()
    pagination.value = { ...pagination.value, page: 1 }
    getListDebounced()
  }

  const sortByChange = (option: DatatableOrderingOption) => {
    setSortBy(option.sortBy)
    pagination.value = { ...pagination.value, page: 1 }
    getListDebounced()
  }

  const onFetchNextPage = async () => {
    loading.value = true
    const page = incrementPage()
    try {
      const res = (await execute(pagination, filterData, filterConfig, fetchParams)) as TItem[]
      items.value.push(...res)
    } catch (e) {
      // Not when a reopen, sort change or filter submit reset the page meanwhile: that reset stands.
      if (pagination.value.page === page) pagination.value = { ...pagination.value, page: page - 1 }
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
      items.value = (await execute(pagination, filterData, filterConfig, fetchParams)) as TItem[]
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      loading.value = false
    }
  }

  const getListDebounced = useDebounceFn(async () => {
    await getList()
  })

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
    getList: getListDebounced,
    resetFilter: () => resetFilter(pagination, getListDebounced),
    submitFilter: () => submitFilter(pagination, getListDebounced),
  }
}
