import { type Ref, ref } from 'vue'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { Pagination } from '@/labs/filters/pagination'
import { useAlerts } from '@/composables/system/alerts'
import { useFetchAuthorList } from '@/components/damImage/uploadQueue/api/authorApi'
import { damClient } from '@/playground/mock/coreDamClient'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import { SORT_BY_ID, SortOrder } from '@/composables/system/datatableColumns'

const datatableHiddenColumns = ref<Array<string>>(['id'])
const listLoading = ref(false)
const currentExtSystemId = ref(1)

export const useAuthorListActions = () => {
  const { showErrorsDefault } = useAlerts()
  const { executeFetch } = useFetchAuthorList(damClient, currentExtSystemId.value)
  const listItems = ref<DamAuthor[]>([])

  const fetchList = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    listLoading.value = true
    pagination.value.sortBy = filterData.text ? null : { key: SORT_BY_ID, order: SortOrder.Desc }
    try {
      listItems.value = await executeFetch(pagination, filterData, filterConfig)
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
