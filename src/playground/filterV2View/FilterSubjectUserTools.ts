import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds2 } from '@/services/api/v2/apiFetchByIds2'
import { useApiFetchList } from '@/services/api/v2/useApiFetchList'
import type { Pagination2 } from '@/types/Pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/composables/filter/filterFactory'
import { reactive, type Ref } from 'vue'

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

const fetchUserListByIds = (ids: IntegerId[]) => apiFetchByIds2<User[]>(cmsClient, ids, END_POINT, {}, 'cms', 'user')

const useFetchUserList = () => useApiFetchList<User[]>(cmsClient, END_POINT, {}, 'cms', 'user')

export const fetchItems = async (pagination: Ref<Pagination2>, filterData: FilterData, filterConfig: FilterConfig) => {
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
  pagination: Ref<Pagination2>,
  filterData: FilterData,
  filterConfig: FilterConfig
) => {
  const { executeFetch } = useFetchUserList()
  return mapToMinimals(await executeFetch(pagination, filterData, filterConfig))
}

export const fetchItemsMinimalByIds = async (ids: IntegerId[]) => {
  return mapToMinimals(await fetchUserListByIds(ids))
}

export function useSubjectUserInnerFilter() {
  const filterFields = [
    { name: 'id' as const, variant: 'in' },
    { name: 'lastName' as const, variant: 'startsWith', apiName: 'person.lastName' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(
    filterFields,
    reactive<FilterStore<{ name: (typeof filterFields)[number]['name'] }[]>>({
      id: null,
      lastName: null,
    }),
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
