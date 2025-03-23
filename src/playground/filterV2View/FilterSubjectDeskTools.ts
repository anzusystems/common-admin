import type { Pagination } from '@/types/Pagination'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchList } from '@/services/api/v2/apiFetchList.ts'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { createFilter, type FilterConfig, type FilterData } from '@/composables/filter/filterFactory.ts'

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

const fetchDeskList = (pagination: Pagination, filterData: FilterData<any>, filterConfig: FilterConfig<any>) =>
  apiFetchList<Desk[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'desk')

const fetchDeskListByIds = (ids: IntegerId[]) => apiFetchByIds<Desk[]>(cmsClient, ids, END_POINT, {}, 'cms', 'desk')

export const fetchItems = async (
  pagination: Pagination,
  filterData: FilterData<any>,
  filterConfig: FilterConfig<any>
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
  const { filterConfig, filterData } = createFilter(
    [
      { name: 'id' as const, default: null },
      { name: 'ids' as const, variant: 'in', field: 'id', default: [] },
      { name: 'name' as const, variant: 'startsWith', default: null },
    ],
    {
      system: 'cms',
      subject: 'desk',
    }
  )

  return {
    filterConfig,
    filterData,
  }
}
