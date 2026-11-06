import type { DamAssetLicence } from '@/domains/dam/types/AssetLicence'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { Pagination } from '@/domains/api/composables/pagination'
import { fetchDamAssetLicenceListByIds, useFetchDamAssetLicenceList } from '@/domains/dam/user/api/assetLicenceApi'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

export const useAssetLicenceSelectActions = (client: () => AxiosInstance) => {
  const { execute } = useFetchDamAssetLicenceList(client)

  const mapToValueObjectOption = (assetLicences: DamAssetLicence[]): ValueObjectOption<IntegerId>[] => {
    return assetLicences.map((assetLicence: DamAssetLicence) => ({
      title: assetLicence.name,
      value: assetLicence.id,
    }))
  }

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjectOption(await execute(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjectOption(await fetchDamAssetLicenceListByIds(client, ids))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
