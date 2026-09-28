import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { type Ref } from 'vue'

import type { Pagination } from '@/domains/api/composables/pagination'

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
  const { execute } = useApiFetchByIds<Site>({
    client: cmsClient,
    system: 'cms',
    entity: 'site',
    urlTemplate: END_POINT,
  })
  return execute(ids)
}

const useFetchSiteList = () =>
  useApiFetchList<Site>({
    client: cmsClient,
    system: 'cms',
    entity: 'site',
    urlTemplate: END_POINT,
  })

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { execute } = useFetchSiteList()
  const sites = await execute(pagination, filterData, filterConfig)

  return sites.map((site: Site) => ({
    title: site.name,
    value: site.id,
  })) as ValueObjectOption<IntegerId>[]
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const sites = await fetchSiteListByIds(ids)

  return sites.map((site: Site) => ({
    title: site.name,
    value: site.id,
  })) as ValueObjectOption<IntegerId>[]
}

export function useSubjectSiteInnerFilter() {
  const filterFields = [
    { name: 'id' as const, variant: 'in', default: null },
    { name: 'name' as const, variant: 'startsWith', default: null },
    { name: 'siteGroup' as const, default: null },
    { name: 'linkedList' as const, default: null },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFields, createFilterStore(filterFields), {
    system: 'cms',
    subject: 'site',
  })

  return {
    filterConfig,
    filterData,
  }
}
