<script lang="ts" setup>
import type { Filter } from '@anzusystems/common-admin'
import { AFilterRemoteAutocomplete } from '@anzusystems/common-admin'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import type { AnzuUser } from '@/types/AnzuUser'
import { reactive } from 'vue'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/apiFetchList'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { ValueObjectOption } from '@/types/ValueObject'

export interface User extends AnzuUser {
  mainSite: IntegerIdNullable
  mainRubric: IntegerIdNullable
  allowedSites: IntegerId[]
  viewableBoxes: IntegerId[]
  editableBoxes: IntegerId[]
  desks: IntegerId[]
  followingDesks: IntegerId[]
  editingDesks: IntegerId[]
  followingStages: IntegerId[]
  editingStages: IntegerId[]
  allowedInboxes: IntegerId[]
  homePageUi: string
  _resourceName: string
  _system: string
}

const modelValue = defineModel<Filter>({ required: true })

const END_POINT = '/adm/users'

const fetchUserListByIds = (ids: IntegerId[]) => apiFetchByIds<User[]>(cmsClient, ids, END_POINT, {}, 'cms', 'user')

const fetchUserList = (pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<User[]>(cmsClient, END_POINT, {}, pagination, filterBag, 'cms', 'user')

const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
  const users = await fetchUserList(pagination, filterBag)

  return <ValueObjectOption<IntegerId>[]>users.map((user: User) => ({
    title: user.person.fullName,
    value: user.id,
  }))
}

const fetchItemsByIds = async (ids: IntegerId[]) => {
  const users = await fetchUserListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>users.map((user: User) => ({
    title: user.person.fullName,
    value: user.id,
  }))
}

const makeFilter = makeFilterHelper('cms', 'user')

const innerFilter = reactive({
  id: {
    ...makeFilter({ name: 'id', variant: 'in' }),
  },
  lastName: {
    ...makeFilter({ name: 'lastName', variant: 'startsWith', field: 'person.lastName' }),
  },
})
</script>

<template>
  <AFilterRemoteAutocomplete
    v-model="modelValue"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
    filter-by-field="lastName"
  />
</template>
