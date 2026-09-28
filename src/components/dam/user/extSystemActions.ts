import type { Pagination } from '@/labs/filters/pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { DamExtSystem } from '@/components/damImage/uploadQueue/composables/DamExtSystem'
import type { AxiosInstance } from 'axios'
import { fetchDamExtSystemListByIds, useFetchDamExtSystemList } from '@/components/dam/user/extSystemApi'
import type { IntegerId } from '@/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useExtSystemSelectActions = (client: () => AxiosInstance) => {
  const { execute } = useFetchDamExtSystemList(client)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    const extSystems = await execute(pagination, filterData, filterConfig)

    return extSystems.map((extSystem: DamExtSystem) => ({
      title: extSystem.slug,
      value: extSystem.id,
    })) as ValueObjectOption<IntegerId>[]
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    const extSystems = await fetchDamExtSystemListByIds(client, ids)

    return extSystems.map((extSystem: DamExtSystem) => ({
      title: extSystem.slug,
      value: extSystem.id,
    })) as ValueObjectOption<IntegerId>[]
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
