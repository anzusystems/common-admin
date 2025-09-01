import type { Pagination } from '@/labs/filters/pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { DamExtSystem } from '@/components/damImage/uploadQueue/composables/DamExtSystem'
import type { AxiosInstance } from 'axios'
import { fetchDamExtSystemListByIds, useFetchDamExtSystemList } from '@/components/dam/user/extSystemApi'
import type { IntegerId } from '@/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useExtSystemSelectActions = (client: () => AxiosInstance) => {
  const { executeFetch } = useFetchDamExtSystemList(client)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    const extSystems = await executeFetch(pagination, filterData, filterConfig)

    return <ValueObjectOption<IntegerId>[]>extSystems.map((extSystem: DamExtSystem) => ({
      title: extSystem.slug,
      value: extSystem.id,
    }))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    const extSystems = await fetchDamExtSystemListByIds(client, ids)

    return <ValueObjectOption<IntegerId>[]>extSystems.map((extSystem: DamExtSystem) => ({
      title: extSystem.slug,
      value: extSystem.id,
    }))
  }

  return {
    fetchItems,
    fetchItemsByIds,
  }
}
