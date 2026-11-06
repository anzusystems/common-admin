import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { Pagination } from '@/domains/api/composables/pagination'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import type { DamAssetLicenceGroup } from '@/domains/dam/types/AssetLicenceGroup'
import {
  fetchDamAssetLicenceGroupListByIds,
  useFetchDamAssetLicenceGroupList,
} from '@/domains/dam/user/api/assetLicenceGroupApi'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

export const useAssetLicenceGroupSelectActions = (client: () => AxiosInstance) => {
  const { execute } = useFetchDamAssetLicenceGroupList(client)

  const mapToValueObjectOption = (assetLicenceGroups: DamAssetLicenceGroup[]): ValueObjectOption<IntegerId>[] => {
    return assetLicenceGroups.map((assetLicence: DamAssetLicenceGroup) => ({
      title: assetLicence.name,
      value: assetLicence.id,
    }))
  }

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjectOption(await execute(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: number[]) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceGroupListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
