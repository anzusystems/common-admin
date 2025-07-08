import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { type Ref } from 'vue'

import type { Pagination } from '@/labs/filters/pagination'

export interface Desk extends AnzuUserAndTimeTrackingAware {
  name: string
  id: IntegerId
  siteGroup: IntegerIdNullable
  members: IntegerId[]
  editors: IntegerId[]
  followers: IntegerId[]
  pages: IntegerId[]
  externalLinks: any[]
  rubrics: IntegerId[]
  keywords: IntegerId[]
  _resourceName: 'desk'
  _system: 'cms'
}

const END_POINT = '/adm/desks'

const useFetchDeskList = () => useApiFetchList<Desk[]>(cmsClient, 'cms', 'desk')

const fetchDeskListByIds = (ids: IntegerId[]) => {
  const { executeFetch } = useApiFetchByIds<Desk[]>(cmsClient, 'cms', 'desk')
  return executeFetch(ids, END_POINT)
}

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { executeFetch } = useFetchDeskList()
  const desks = await executeFetch(pagination, filterData, filterConfig, END_POINT)

  return <ValueObjectOption<IntegerId>[]>desks.map((desk: Desk) => ({
    title: desk.name,
    value: desk.id,
  }))
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const desks = await fetchDeskListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>desks.map((desk: Desk) => ({
    title: desk.name,
    value: desk.id,
  }))
}

export function useSubjectDeskInnerFilter() {
  const filterFields = [
    { name: 'id', default: null },
    { name: 'ids', variant: 'in', apiName: 'id', default: [] },
    { name: 'name', variant: 'startsWith', default: null },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFields, createFilterStore(filterFields), {
    system: 'cms',
    subject: 'desk',
  })

  return {
    filterConfig,
    filterData,
  }
}
