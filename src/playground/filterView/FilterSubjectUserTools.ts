import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { cmsClient } from '@/playground/mock/cmsClient'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import type { ValueObjectOption } from '@/types/ValueObject'
import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { type Ref } from 'vue'

import type { Pagination } from '@/labs/filters/pagination'

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

export interface UserMinimal {
  id: IntegerIdNullable | undefined
  title: string
  active: boolean
}

const END_POINT = '/adm/users'

const fetchUserListByIds = (ids: IntegerId[]) => {
  const { executeFetch } = useApiFetchByIds<User[]>(cmsClient, 'cms', 'user', END_POINT)
  return executeFetch(ids)
}

const useFetchUserList = () => useApiFetchList<User[]>(cmsClient, 'cms', 'user', END_POINT)

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { executeFetch } = useFetchUserList()
  const users = await executeFetch(pagination, filterData, filterConfig)

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

const mapToMinimal = (user: User): UserMinimal => ({
  id: user.id,
  title: user.person.fullName || user.email,
  active: true,
})

const mapToMinimals = (users: User[]): UserMinimal[] => {
  return users.map((user: User) => mapToMinimal(user))
}

export const fetchItemsMinimal = async (
  pagination: Ref<Pagination>,
  filterData: FilterData,
  filterConfig: FilterConfig
) => {
  const { executeFetch } = useFetchUserList()
  return mapToMinimals(await executeFetch(pagination, filterData, filterConfig, END_POINT))
}

export const fetchItemsMinimalByIds = async (ids: IntegerId[]) => {
  return mapToMinimals(await fetchUserListByIds(ids))
}

export function useSubjectUserInnerFilter() {
  const filterFields = [
    { name: 'id' as const, variant: 'in', default: null },
    { name: 'lastName' as const, variant: 'startsWith', apiName: 'person.lastName', default: null },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFields, createFilterStore(filterFields), {
    system: 'cms',
    subject: 'user',
  })

  return {
    filterConfig,
    filterData,
  }
}
