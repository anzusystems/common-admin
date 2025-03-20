<script lang="ts" setup>
import type { Filter } from '@anzusystems/common-admin'
import { AFilterRemoteAutocomplete } from '@anzusystems/common-admin'
import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/apiFetchList'

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

const modelValue = defineModel<Filter>({ required: true })

const END_POINT = '/adm/v1/site'

const fetchSiteListByIds = (ids: IntegerId[]) => apiFetchByIds<Site[]>(cmsClient, ids, END_POINT, {}, 'cms', 'site')

const fetchSiteList = (pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<Site[]>(cmsClient, END_POINT, {}, pagination, filterBag, 'cms', 'site')

const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
  const sites = await fetchSiteList(pagination, filterBag)

  return <ValueObjectOption<IntegerId>[]>sites.map((site: Site) => ({
    title: site.name,
    value: site.id,
  }))
}

const fetchItemsByIds = async (ids: IntegerId[]) => {
  const sites = await fetchSiteListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>sites.map((site: Site) => ({
    title: site.name,
    value: site.id,
  }))
}

const makeFilter = makeFilterHelper('cms', 'site')

const innerFilter = reactive({
  id: {
    ...makeFilter({ name: 'id', variant: 'in' }),
  },
  name: {
    ...makeFilter({ name: 'name', variant: 'startsWith' }),
  },
  siteGroup: {
    ...makeFilter({ name: 'siteGroup' }),
  },
  linkedList: {
    ...makeFilter({ name: 'linkedList' }),
  },
})
</script>

<template>
  <AFilterRemoteAutocomplete
    v-model="modelValue"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
  />
</template>
