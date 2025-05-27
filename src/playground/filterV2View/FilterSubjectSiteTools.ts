import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { ValueObjectOption } from '@/types/ValueObject'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { reactive, type Ref } from 'vue'

import type { Pagination } from '@/labs/filters/pagination'

export interface SiteMinimal {
  id: IntegerId
  siteGroup: IntegerIdNullable
  name: string
  domain: string
}

interface Site extends SiteMinimal, AnzuUserAndTimeTrackingAware {
  language: any
  siteGroup: IntegerIdNullable
  linkedList: IntegerIdNullable
  bottomMobileLinkedList: IntegerIdNullable
  secondaryLinkedList: IntegerIdNullable
  siteMapLinkedList: IntegerIdNullable
  designSettings: IntegerIdNullable
  authorLayoutTemplate: IntegerIdNullable
  galleryLayoutTemplate: IntegerIdNullable
  forumLayoutTemplate: IntegerIdNullable
  advertSettings: IntegerIdNullable
  primaryNewsletter: IntegerIdNullable
  secondaryNewsletter: IntegerIdNullable
  searchPage: IntegerIdNullable
  mainPage: IntegerIdNullable
  favoriteBox: IntegerIdNullable
  seo: {
    postfix: string
    globalMetaTags: any[]
    articleMetaTags: any[]
    robots: string
  }
  seoImage: IntegerIdNullable
  settings: {
    overrideParentContentLockSettings: boolean
    lockAfterPercentage: number
    allowedFreeRss: boolean
  }
  rssTexts: {
    title: string
    description: string
    webMaster: string
  }
  analytics: {
    rempPropertyToken: string
    gtmId: string
    gemiusId: string
    gemiusStreamPlayerId: string
    gemiusStreamId: string
    rempGdpr: boolean
    deepGdpr: boolean
  }
  domain: string
  slug: string
  epilogue: string
  _resourceName: 'site'
  _system: 'cms'
}

// const modelValue = defineModel<Filter>({ required: true })

const END_POINT = '/adm/v1/site'

const fetchSiteListByIds = (ids: IntegerId[]) => {
  const { executeFetch } = useApiFetchByIds<Site[]>(cmsClient, 'cms', 'site')
  return executeFetch(ids, END_POINT)
}

const useFetchSiteList = () => useApiFetchList<Site[]>(cmsClient, 'cms', 'site')

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { executeFetch } = useFetchSiteList()
  const sites = await executeFetch(pagination, filterData, filterConfig, END_POINT)

  return <ValueObjectOption<IntegerId>[]>sites.map((site: Site) => ({
    title: site.name,
    value: site.id,
  }))
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const sites = await fetchSiteListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>sites.map((site: Site) => ({
    title: site.name,
    value: site.id,
  }))
}

export function useSubjectSiteInnerFilter() {
  const filterFields = [
    { name: 'id' as const, variant: 'in' },
    { name: 'name' as const, variant: 'startsWith' },
    { name: 'siteGroup' as const },
    { name: 'linkedList' as const },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(
    filterFields,
    reactive<FilterStore<{ name: (typeof filterFields)[number]['name'] }[]>>({
      id: null,
      name: null,
      siteGroup: null,
      linkedList: null,
    }),
    {
      system: 'cms',
      subject: 'site',
    }
  )

  return {
    filterConfig,
    filterData,
  }
}
