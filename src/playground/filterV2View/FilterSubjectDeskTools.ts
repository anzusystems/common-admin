import type { Pagination } from '@/types/Pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchList } from '@/services/api/v2/apiFetchList.ts'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/composables/filter/filterFactory.ts'
import { reactive } from 'vue'

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

const fetchDeskList = (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) =>
  apiFetchList<Desk[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'desk')

const fetchDeskListByIds = (ids: IntegerId[]) => apiFetchByIds<Desk[]>(cmsClient, ids, END_POINT, {}, 'cms', 'desk')

export const fetchItems = async (
  pagination: Pagination,
  filterData: FilterData,
  filterConfig: FilterConfig
) => {
  const desks = await fetchDeskList(pagination, filterData, filterConfig)

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
    { name: 'id' },
    { name: 'ids', variant: 'in', field: 'id' },
    { name: 'name', variant: 'startsWith' },
  ] satisfies readonly MakeFilterOption[]

  const store = reactive<FilterStore<{ name: (typeof filterFields)[number]['name'] }[]>>({
    id: null,
    ids: [] as IntegerId[],
    name: null,
  })

  const { filterConfig, filterData } = createFilter(filterFields, store, {
    system: 'cms',
    subject: 'desk',
  })

  return {
    filterConfig,
    filterData,
  }
}
