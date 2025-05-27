import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/composables/filter/filterFactory'
import { useApiFetchList } from '@/services/api/v2/useApiFetchList'
import { useApiFetchByIds } from '@/services/api/v2/useApiFetchByIds'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { ValueObjectOption } from '@/types/ValueObject'
import { cmsClient } from '@/playground/mock/cmsClient'
import type { Pagination2 } from '@/types/Pagination'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { reactive, type Ref } from 'vue'

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
  const { executeFetch } = useApiFetchByIds<Rubric[]>(cmsClient, 'cms', 'rubric')
  return executeFetch(ids, END_POINT)
}

const useFetchRubricList = () => useApiFetchList<Rubric[]>(cmsClient, 'cms', 'rubric')

export const fetchItems = async (pagination: Ref<Pagination2>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { executeFetch } = useFetchRubricList()
  const rubrics = await executeFetch(pagination, filterData, filterConfig, END_POINT)

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
  const filterFields = [
    { name: 'id' as const, variant: 'in' },
    { name: 'text' as const },
    { name: 'site' as const, apiName: 'siteIds' },
    { name: 'siteGroup' as const, apiName: 'siteGroupIds' },
    { name: 'desk' as const, apiName: 'deskIds' },
    { name: 'linkedList' as const, apiName: 'linkedListId' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(
    filterFields,
    reactive<FilterStore<{ name: (typeof filterFields)[number]['name'] }[]>>({
      id: null,
      text: null,
      site: [],
      siteGroup: [],
      desk: [],
      linkedList: null,
    }),
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
