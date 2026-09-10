import type { DamAssetListViewResolved } from '@/types/coreDam/AssetListView'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/labs/filters/pagination'
import {
  fetchDamAssetListViewListByIds,
  useFetchDamAssetListViewList,
} from '@/components/dam/user/assetListViewApi'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useAssetListViewSelectActions = (client: () => AxiosInstance) => {
  const { executeFetch } = useFetchDamAssetListViewList(client)

  const mapToValueObjectOption = (
    listViews: DamAssetListViewResolved[],
  ): ValueObjectOption<IntegerId>[] => {
    return listViews.map((listView: DamAssetListViewResolved) => ({
      title: listView.name,
      value: listView.id,
    }))
  }

  const fetchItems = async (
    pagination: Ref<Pagination>,
    filterData: FilterData,
    filterConfig: FilterConfig,
  ) => {
    return mapToValueObjectOption(await executeFetch(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjectOption(await fetchDamAssetListViewListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
