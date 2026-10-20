import type { AxiosInstance } from 'axios'
import type { DamUser } from '@/domains/dam/user/types/DamUser'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { IntegerId } from '@/shared/types/common'
import type { Pagination } from '@/domains/api/composables/pagination'
import { fetchDamUserListByIds, useFetchDamUserList } from '@/domains/dam/user/api/userApi'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

/** `endPoint`: the address of the users (`endPointUser` of a configuration); `/adm/v1/user` where left out. */
export const useDamUserSelectAction = (client: () => AxiosInstance, endPoint?: string) => {
  const mapToValueObject = (user: DamUser): ValueObjectOption<IntegerId> => ({
    title: '' === user.person.fullName ? user.email : user.person.fullName,
    value: user.id,
  })

  const mapToValueObjects = (users: DamUser[]): ValueObjectOption<IntegerId>[] => {
    return users.map((user: DamUser) => mapToValueObject(user))
  }

  const { execute } = useFetchDamUserList(client, endPoint)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjects(await execute(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: IntegerId[]) => {
    return mapToValueObjects(await fetchDamUserListByIds(client, ids, endPoint))
  }

  return {
    mapToValueObject,
    fetchItems,
    fetchItemsByIds,
  }
}
