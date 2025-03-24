import { createFilter, type FilterConfig, type FilterData } from '@/composables/filter/filterFactory.ts'
import { apiFetchList } from '@/services/api/v2/apiFetchList.ts'
import { apiFetchByIds } from '@/services/api/v2/apiFetchByIds.ts'
import type { IntegerId, IntegerIdNullable } from '@/types/common.ts'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import { cmsClient } from '@/playground/mock/cmsClient.ts'
import type { Pagination } from '@/types/Pagination.ts'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware.ts'

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

const fetchRubricListByIds = (ids: IntegerId[]) =>
  apiFetchByIds<Rubric[]>(cmsClient, ids, END_POINT, {}, 'cms', 'rubric')

const fetchRubricList = (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) =>
  apiFetchList<Rubric[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'rubric')

export const fetchItems = async (
  pagination: Pagination,
  filterData: FilterData,
  filterConfig: FilterConfig
) => {
  const rubrics = await fetchRubricList(pagination, filterData, filterConfig)

  return <ValueObjectOption<IntegerId>[]>rubrics.map((rubric: Rubric) => ({
    title: rubric.texts.title,
    value: rubric.id,
  }))
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const rubrics = await fetchRubricListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>rubrics.map((rubric: Rubric) => ({
    title: rubric.texts.title,
    value: rubric.id,
  }))
}

export function useSubjectRubricInnerFilter() {
  const { filterConfig, filterData } = createFilter(
    [
      { name: 'id' as const, variant: 'in', default: null },
      { name: 'text' as const, default: null },
      { name: 'site' as const, field: 'siteIds', default: [] as IntegerId[] },
      { name: 'siteGroup' as const, field: 'siteGroupIds', default: [] as IntegerId[] },
      { name: 'desk' as const, field: 'deskIds', default: [] as IntegerId[] },
      { name: 'linkedList' as const, field: 'linkedListId', default: null },
    ],
    {
      elastic: true,
      system: 'cms',
      subject: 'rubric',
    }
  )

  return {
    filterConfig,
    filterData,
  }
}
