import type { Pagination } from '@/domains/api/composables/pagination'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { DamExtSystem } from '@/domains/dam/types/DamExtSystem'
import type { AxiosInstance } from 'axios'
import { fetchDamExtSystemListByIds, useFetchDamExtSystemList } from '@/domains/dam/user/api/extSystemApi'
import type { IntegerId } from '@/shared/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

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
