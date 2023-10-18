import { createDatatableColumnsConfig, type DatatableOrderingOption } from '@/composables/system/datatableColumns'
import type { VDatatableSelectableItem } from '@/components/subjectSelect/selectStrategies'
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'

export function useSubjectSelect<TItem>(
  datatableConfig: any,
  datatableHiddenColumns: any,
  system: string,
  subject: string,
  fetch: (pag: Pagination, fb: FilterBag) => Promise<Array<TItem>>,
  filter: FilterBag,
  maxCount: Ref<number>
) {
  const filterTouched: Ref<boolean> = ref(false)
  const items: Ref<Array<TItem>> = ref([])
  const selected: Ref<Array<TItem>> = ref([])

  const { resetFilter, submitFilter } = useFilterHelpers()

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

  const customToggleSelect = (
    toggle: (item: VDatatableSelectableItem) => void,
    isSelected: (item: VDatatableSelectableItem) => boolean,
    internalItem: VDatatableSelectableItem
  ) => {
    if (selected.value.length < maxCount.value || isSelected(internalItem)) {
      toggle(internalItem)
      return true
    }
    return false
  }

  const onFetchNextPage = async () => {
    pagination.page++
    items.value.push(...(await fetch(pagination, filter)))
  }

  const resetState = () => {
    items.value = []
    selected.value = []
  }

  const getList = async () => {
    items.value = await fetch(pagination, filter)
  }

  return {
    items,
    selected,
    pagination,
    columnsVisible,
    columnsHidden,
    columnsAll,
    filterTouched,
    onFetchNextPage,
    customToggleSelect,
    onOpen,
    sortByChange,
    getList,
    resetFilter: () => resetFilter(filter, pagination, getList),
    submitFilter: () => submitFilter(filter, pagination, getList),
  }
}
