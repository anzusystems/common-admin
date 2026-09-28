import type { AxiosInstance } from 'axios'
import type { DamUser } from '@/domains/dam/user/types/DamUser'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { IntegerId } from '@/shared/types/common'
import type { Pagination } from '@/domains/api/composables/pagination'
import { fetchDamUserListByIds, useFetchDamUserList } from '@/domains/dam/user/api/userApi'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

export const useDamUserSelectAction = (client: () => AxiosInstance) => {
  const mapToValueObject = (user: DamUser): ValueObjectOption<IntegerId> => ({
    title: '' === user.person.fullName ? user.email : user.person.fullName,
    value: user.id,
  })

  const mapToValueObjects = (users: DamUser[]): ValueObjectOption<IntegerId>[] => {
    return users.map((user: DamUser) => mapToValueObject(user))
  }

  const { execute } = useFetchDamUserList(client)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjects(await execute(pagination, filterData, filterConfig))
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
