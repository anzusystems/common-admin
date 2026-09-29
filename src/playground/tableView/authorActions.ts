import { type Ref, ref } from 'vue'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import type { Pagination } from '@/domains/api/composables/pagination'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useFetchAuthorList } from '@/domains/dam/author/api/authorApi'
import { damClient } from '@/playground/mock/coreDamClient'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import { SORT_BY_ID } from '@/domains/filters/datatable/utils/datatableColumns'
import { SortOrder } from '@/domains/api/types/SortOrder'

const datatableHiddenColumns = ref<Array<string>>(['id'])
const listLoading = ref(false)
const currentExtSystemId = ref(1)

export const useAuthorListActions = () => {
  const { showErrorsDefault } = useAlerts()
  const { execute } = useFetchAuthorList(damClient, currentExtSystemId.value)
  const listItems = ref<DamAuthor[]>([])

  const fetchList = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    listLoading.value = true
    pagination.value.sortBy = filterData.text ? null : { key: SORT_BY_ID, order: SortOrder.Desc }
    try {
      listItems.value = await execute(pagination, filterData, filterConfig)
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      listLoading.value = false
    }
  }

  return {
    datatableHiddenColumns,
    listLoading,
    listItems,
    fetchList,
  }
}
