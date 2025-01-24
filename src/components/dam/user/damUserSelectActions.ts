import type { AxiosInstance } from 'axios'
import type { DamUser } from '@/components/dam/user/DamUser'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId } from '@/types/common'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { fetchDamUserList, fetchDamUserListByIds } from '@/components/dam/user/userApi'

export const useDamUserSelectAction = (client: () => AxiosInstance) => {
  const mapToValueObject = (user: DamUser): ValueObjectOption<IntegerId> => ({
    title: '' === user.person.fullName ? user.email : user.person.fullName,
    value: user.id,
  })

  const mapToValueObjects = (users: DamUser[]): ValueObjectOption<IntegerId>[] => {
    return users.map((user: DamUser) => mapToValueObject(user))
  }

  const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
    return mapToValueObjects(await fetchDamUserList(client, pagination, filterBag))
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
