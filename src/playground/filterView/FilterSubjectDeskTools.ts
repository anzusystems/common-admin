import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { type Ref } from 'vue'

import type { Pagination } from '@/domains/api/composables/pagination'

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

const useFetchDeskList = () =>
  useApiFetchList<Desk>({
    client: cmsClient,
    system: 'cms',
    entity: 'desk',
    urlTemplate: END_POINT,
  })

const fetchDeskListByIds = (ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<Desk>({
    client: cmsClient,
    system: 'cms',
    entity: 'desk',
    urlTemplate: END_POINT,
  })
  return execute(ids)
}

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { execute } = useFetchDeskList()
  const desks = await execute(pagination, filterData, filterConfig)

  return desks.map((desk: Desk) => ({
    title: desk.name,
    value: desk.id,
  })) as ValueObjectOption<IntegerId>[]
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const desks = await fetchDeskListByIds(ids)

  return desks.map((desk: Desk) => ({
    title: desk.name,
    value: desk.id,
  })) as ValueObjectOption<IntegerId>[]
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
