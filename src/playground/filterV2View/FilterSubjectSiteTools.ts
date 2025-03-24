import type { IntegerId, IntegerIdNullable } from '@/types/common.ts'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import { apiFetchByIds } from '@/services/api/v2/apiFetchByIds.ts'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware.ts'
import type { Pagination } from '@/types/Pagination.ts'
import { cmsClient } from '@/playground/mock/cmsClient.ts'
import { apiFetchList } from '@/services/api/v2/apiFetchList.ts'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/composables/filter/filterFactory.ts'
import { reactive } from 'vue'

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

const fetchSiteListByIds = (ids: IntegerId[]) => apiFetchByIds<Site[]>(cmsClient, ids, END_POINT, {}, 'cms', 'site')

const fetchSiteList = (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) =>
  apiFetchList<Site[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'site')

export const fetchItems = async (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) => {
  const sites = await fetchSiteList(pagination, filterData, filterConfig)

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
  const filterFields: MakeFilterOption[] = [
    { name: 'id' as const, variant: 'in', default: null },
    { name: 'name' as const, variant: 'startsWith', default: null },
    { name: 'siteGroup' as const, default: null },
    { name: 'linkedList' as const, default: null },
  ]

  const store = reactive<FilterStore<typeof filterFields>>({
    id: null,
    name: null,
    siteGroup: null,
    linkedList: null,
  })

  const { filterConfig, filterData } = createFilter(filterFields, store, {
    system: 'cms',
    subject: 'site',
  })

  return {
    filterConfig,
    filterData,
  }
}
