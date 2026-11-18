import type { DamAssetListViewMinimal } from '@/domains/dam/types/AssetListView'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { Pagination } from '@/domains/api/composables/pagination'
import { fetchDamAssetListViewListByIds, useFetchDamAssetListViewList } from '@/domains/dam/user/api/assetListViewApi'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

export const useAssetListViewSelectActions = (client: () => AxiosInstance) => {
  const { execute } = useFetchDamAssetListViewList(client)

  const mapToValueObjectOption = (listViews: DamAssetListViewMinimal[]): ValueObjectOption<IntegerId>[] => {
    return listViews.map((listView: DamAssetListViewMinimal) => ({
      title: listView.name,
      value: listView.id,
    }))
  }

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjectOption(await execute(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjectOption(await fetchDamAssetListViewListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
