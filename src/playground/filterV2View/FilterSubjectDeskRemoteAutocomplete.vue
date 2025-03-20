<script lang="ts" setup>
import { AFilterRemoteAutocomplete, type Filter } from '@anzusystems/common-admin'
import { reactive } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchList } from '@/services/api/apiFetchList'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'

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

const modelValue = defineModel<Filter>({ required: true })

const END_POINT = '/adm/desks'

const fetchDeskList = (pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<Desk[]>(cmsClient, END_POINT, {}, pagination, filterBag, 'cms', 'desk')

const fetchDeskListByIds = (ids: IntegerId[]) => apiFetchByIds<Desk[]>(cmsClient, ids, END_POINT, {}, 'cms', 'desk')

const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
  const desks = await fetchDeskList(pagination, filterBag)

  return <ValueObjectOption<IntegerId>[]>desks.map((desk: Desk) => ({
    title: desk.name,
    value: desk.id,
  }))
}

const fetchItemsByIds = async (ids: IntegerId[]) => {
  const desks = await fetchDeskListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>desks.map((desk: Desk) => ({
    title: desk.name,
    value: desk.id,
  }))
}

const makeFilter = makeFilterHelper('cms', 'desk')

const innerFilter = reactive({
  id: {
    ...makeFilter({ name: 'id' }),
  },
  ids: {
    ...makeFilter({ name: 'ids', variant: 'in', field: 'id' }),
  },
  name: {
    ...makeFilter({ name: 'name', variant: 'startsWith' }),
  },
})
</script>

<template>
  <AFilterRemoteAutocomplete
    v-model="modelValue"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
    :filter-sort-by="null"
    filter-by-field="name"
  />
</template>
