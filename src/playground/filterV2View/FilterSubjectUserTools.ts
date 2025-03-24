import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/v2/apiFetchList.ts'
import type { Pagination } from '@/types/Pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import { createFilter, type FilterConfig, type FilterData } from '@/composables/filter/filterFactory.ts'

export interface User extends AnzuUser {
  mainSite: IntegerIdNullable
  mainRubric: IntegerIdNullable
  allowedSites: IntegerId[]
  viewableBoxes: IntegerId[]
  editableBoxes: IntegerId[]
  desks: IntegerId[]
  followingDesks: IntegerId[]
  editingDesks: IntegerId[]
  followingStages: IntegerId[]
  editingStages: IntegerId[]
  allowedInboxes: IntegerId[]
  homePageUi: string
  _resourceName: string
  _system: string
}

const END_POINT = '/adm/users'

const fetchUserListByIds = (ids: IntegerId[]) => apiFetchByIds<User[]>(cmsClient, ids, END_POINT, {}, 'cms', 'user')

const fetchUserList = (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) =>
  apiFetchList<User[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'user')

export const fetchItems = async (
  pagination: Pagination,
  filterData: FilterData,
  filterConfig: FilterConfig
) => {
  const users = await fetchUserList(pagination, filterData, filterConfig)

  return <ValueObjectOption<IntegerId>[]>users.map((user: User) => ({
    title: user.person.fullName,
    value: user.id,
  }))
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const users = await fetchUserListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>users.map((user: User) => ({
    title: user.person.fullName,
    value: user.id,
  }))
}

export function useSubjectUserInnerFilter() {
  const { filterConfig, filterData } = createFilter(
    [
      { name: 'id' as const, variant: 'in', default: null },
      { name: 'lastName' as const, variant: 'startsWith', field: 'person.lastName', default: null },
    ],
    {
      system: 'cms',
      subject: 'user',
    }
  )

  return {
    filterConfig,
    filterData,
  }
}
