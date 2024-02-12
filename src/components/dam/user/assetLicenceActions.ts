import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { fetchDamAssetLicenceList, fetchDamAssetLicenceListByIds } from '@/components/dam/user/assetLicenceApi'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'

export const useAssetLicenceSelectActions = (client: () => AxiosInstance) => {
  const mapToValueObjectOption = (assetLicences: DamAssetLicence[]): ValueObjectOption<IntegerId>[] => {
    return assetLicences.map((assetLicence: DamAssetLicence) => ({
      title: assetLicence.name,
      value: assetLicence.id,
    }))
  }

  const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceList(client, pagination, filterBag))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
