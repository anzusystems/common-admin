import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { DamAssetLicenceGroup } from '@/types/coreDam/AssetLicenceGroup'
import {
  fetchDamAssetLicenceGroupList,
  fetchDamAssetLicenceGroupListByIds,
} from '@/components/dam/user/assetLicenceGroupApi'

export const useAssetLicenceGroupSelectActions = (client: () => AxiosInstance) => {
  const mapToValueObjectOption = (assetLicenceGroups: DamAssetLicenceGroup[]): ValueObjectOption<IntegerId>[] => {
    return assetLicenceGroups.map((assetLicence: DamAssetLicenceGroup) => ({
      title: assetLicence.name,
      value: assetLicence.id,
    }))
  }

  const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceGroupList(client, pagination, filterBag))
  }

  const fetchItemsByIds = async (ids: number[]) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceGroupListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
