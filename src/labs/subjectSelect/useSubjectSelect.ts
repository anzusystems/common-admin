import { type DatatableOrderingOption, type DatatableSortBy } from '@/composables/system/datatableColumns'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import { type FilterConfig, type FilterData, useFilterHelpers } from '@/labs/filters/filterFactory'
import { createDatatableColumnsConfig } from '@/labs/filters/datatableColumns'
import { type Pagination, usePagination } from '@/labs/filters/pagination'
import type { UrlParams } from '@/services/api/apiHelper'
import { useDebounceFn } from '@vueuse/core'
import { isNull } from '@/utils/common'

export function useSubjectSelect<TItem>(
  datatableConfig: any,
  datatableHiddenColumns: any,
  system: string,
  subject: string,
  executeFetch: (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>,
    urlTemplateOverride?: string | undefined,
    urlParamsOverride?: UrlParams | undefined,
    forceElastic?: boolean
  ) => Promise<TItem[]>,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>,
  filterSortBy: DatatableSortBy | null = null,
  urlTemplateOverride: string | undefined = undefined,
  urlParamsOverride: UrlParams | undefined = undefined,
  forceElastic: boolean = false
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
    { storeColumnsLocalStorage: false, disableActions: true }
  )

  const onOpen = () => {
    resetState()
    getListDebounced()
  }

  const sortByChange = (option: DatatableOrderingOption) => {
    setSortBy(option.sortBy)
    getListDebounced()
  }

  const onFetchNextPage = async () => {
    loading.value = true
    incrementPage()
    try {
      const res = (await executeFetch(
        pagination,
        filterData,
        filterConfig,
        urlTemplateOverride,
        urlParamsOverride,
        forceElastic
      )) as TItem[]
      items.value.push(...res)
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
      items.value = (await executeFetch(
        pagination,
        filterData,
        filterConfig,
        urlTemplateOverride,
        urlParamsOverride,
        forceElastic
      )) as TItem[]
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
    if (!eventTarget) return
    const parent = eventTarget.parentElement
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
