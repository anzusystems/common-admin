import { ref } from 'vue'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { useAlerts } from '@/composables/system/alerts'
import { fetchAuthorList } from '@/components/damImage/uploadQueue/api/authorApi'
import { damClient } from '@/playground/mock/coreDamClient'

const datatableHiddenColumns = ref<Array<string>>(['id'])
const listLoading = ref(false)
const currentExtSystemId = ref(1)

const { showErrorsDefault } = useAlerts()

export const useAuthorListActions = () => {
  const listItems = ref<DamAuthor[]>([])

  const fetchList = async (pagination: Pagination, filterBag: FilterBag) => {
    listLoading.value = true
    pagination.sortBy = filterBag.text.model ? null : 'id'
    try {
      listItems.value = await fetchAuthorList(damClient, currentExtSystemId.value, pagination, filterBag)
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
