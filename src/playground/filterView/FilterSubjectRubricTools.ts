import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { cmsClient } from '@/playground/mock/cmsClient'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import { type Ref } from 'vue'

import type { Pagination } from '@/domains/api/composables/pagination'

interface Rubric extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  seo: {
    title: string
    slug: string
    description: string
    postfix: string
    articleMetaTags: any[]
  }
  seoImage: IntegerIdNullable
  texts: {
    title: string
    shortTitle: string
    description: string
  }
  attributes: {
    status: any
  }
  settings: {
    overrideParentContentLockSettings: boolean
    lockAfterPercentage: number
  }
  flags: {
    enableArticleMinutes: boolean // todo check
    enableAdverts: boolean
    enableForum: boolean
    privateArticles: boolean
  }
  analytics: {
    rempPropertyToken: string
    gtmId: string
  }
  site: IntegerIdNullable
  siteGroup: IntegerIdNullable
  designSettings: IntegerIdNullable
  advertSettings: IntegerIdNullable
  linkedList: IntegerIdNullable
  bottomMobileLinkedList: IntegerIdNullable
  primaryNewsletter: IntegerIdNullable
  secondaryNewsletter: IntegerIdNullable
  mainPage: IntegerIdNullable
  _resourceName: 'rubric'
  _system: 'cms'
}

const END_POINT = '/adm/v1/rubric'

const fetchRubricListByIds = (ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<Rubric>({
    client: cmsClient,
    system: 'cms',
    entity: 'rubric',
    urlTemplate: END_POINT,
  })
  return execute(ids)
}

const useFetchRubricList = () =>
  useApiFetchList<Rubric>({
    client: cmsClient,
    system: 'cms',
    entity: 'rubric',
    urlTemplate: END_POINT,
  })

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { execute } = useFetchRubricList()
  const rubrics = await execute(pagination, filterData, filterConfig)

  return rubrics.map((rubric: Rubric) => ({
    title: rubric.texts.title,
    value: rubric.id,
  })) as ValueObjectOption<IntegerId>[]
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const rubrics = await fetchRubricListByIds(ids)

  return rubrics.map((rubric: Rubric) => ({
    title: rubric.texts.title,
    value: rubric.id,
  })) as ValueObjectOption<IntegerId>[]
}

export function useSubjectRubricInnerFilter() {
  const filterFields = [
    { name: 'id' as const, variant: 'in', default: null },
    { name: 'text' as const, default: null },
    { name: 'site' as const, apiName: 'siteIds', default: [] },
    { name: 'siteGroup' as const, apiName: 'siteGroupIds', default: [] },
    { name: 'desk' as const, apiName: 'deskIds', default: [] },
    { name: 'linkedList' as const, apiName: 'linkedListId', default: null },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFields, createFilterStore(filterFields), {
    elastic: true,
    system: 'cms',
    subject: 'rubric',
  })

  return {
    filterConfig,
    filterData,
  }
}
