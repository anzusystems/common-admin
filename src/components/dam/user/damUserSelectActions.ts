import type { AxiosInstance } from 'axios'
import type { DamUser } from '@/components/dam/user/DamUser'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId } from '@/types/common'
import type { Pagination } from '@/labs/filters/pagination'
import { fetchDamUserListByIds, useFetchDamUserList } from '@/components/dam/user/userApi'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useDamUserSelectAction = (client: () => AxiosInstance) => {
  const mapToValueObject = (user: DamUser): ValueObjectOption<IntegerId> => ({
    title: '' === user.person.fullName ? user.email : user.person.fullName,
    value: user.id,
  })

  const mapToValueObjects = (users: DamUser[]): ValueObjectOption<IntegerId>[] => {
    return users.map((user: DamUser) => mapToValueObject(user))
  }

  const { executeFetch } = useFetchDamUserList(client)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjects(await executeFetch(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjects(await fetchDamUserListByIds(client, ids))
  }

  return {
    mapToValueObject,
    fetchItems,
    fetchItemsByIds,
  }
}
