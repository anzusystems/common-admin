import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/labs/filters/pagination'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { DamAssetLicenceGroup } from '@/types/coreDam/AssetLicenceGroup'
import {
  fetchDamAssetLicenceGroupListByIds,
  useFetchDamAssetLicenceGroupList,
} from '@/components/dam/user/assetLicenceGroupApi'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useAssetLicenceGroupSelectActions = (client: () => AxiosInstance) => {
  const { executeFetch } = useFetchDamAssetLicenceGroupList(client)

  const mapToValueObjectOption = (assetLicenceGroups: DamAssetLicenceGroup[]): ValueObjectOption<IntegerId>[] => {
    return assetLicenceGroups.map((assetLicence: DamAssetLicenceGroup) => ({
      title: assetLicence.name,
      value: assetLicence.id,
    }))
  }

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjectOption(await executeFetch(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: number[]) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceGroupListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
