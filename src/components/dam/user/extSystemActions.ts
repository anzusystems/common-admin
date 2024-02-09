import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { DamExtSystem } from '@/components/damImage/uploadQueue/composables/DamExtSystem'
import type { AxiosInstance } from 'axios'
import { fetchDamExtSystemList, fetchDamExtSystemListByIds } from '@/components/dam/user/extSystemApi'
import type { IntegerId } from '@/types/common'

export const useExtSystemSelectActions = (client: () => AxiosInstance) => {
  const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
    const extSystems = await fetchDamExtSystemList(client, pagination, filterBag)

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
