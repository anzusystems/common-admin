import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/labs/filters/pagination'
import { fetchDamAssetLicenceListByIds, useFetchDamAssetLicenceList } from '@/components/dam/user/assetLicenceApi'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useAssetLicenceSelectActions = (client: () => AxiosInstance) => {
  const { executeFetch } = useFetchDamAssetLicenceList(client)

  const mapToValueObjectOption = (assetLicences: DamAssetLicence[]): ValueObjectOption<IntegerId>[] => {
    return assetLicences.map((assetLicence: DamAssetLicence) => ({
      title: assetLicence.name,
      value: assetLicence.id,
    }))
  }

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjectOption(await executeFetch(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
