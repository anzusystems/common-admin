<script lang="ts" setup>
import { AFilterRemoteAutocomplete, type Filter } from '@anzusystems/common-admin'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { reactive } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/apiFetchList'

const props = withDefaults(
  defineProps<{
    name: string
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const AuthorDiscriminator = {
  Person: 'person',
  Source: 'source',
} as const

interface AuthorKind extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  site: IntegerIdNullable
  siteGroup: IntegerIdNullable
  discriminator: (typeof AuthorDiscriminator)[keyof typeof AuthorDiscriminator]
  superAuthor: IntegerIdNullable
  slug: string
  descriptionShort: string
  notificationKey: string
  enabled: boolean
  settings: {
    enabledFollow: boolean
    notificationFollowEnabled: boolean
    enabledArticleAssign: boolean
    enabledArticleShow: boolean
    enabledProfile: boolean
  }
  publicLinks: any
  image: IntegerIdNullable
  _resourceName: string
  _system: 'cms'
}

interface AuthorKindPerson extends AuthorKind {
  discriminator: typeof AuthorDiscriminator.Person
  description: any
  jobDescription: string
  person: {
    firstName: string
    lastName: string
    fullName: string
  }
  _resourceName: 'authorKindPerson'
}

const isAuthorKindPerson = (author: AuthorKind): author is AuthorKindPerson => {
  return author.discriminator === AuthorDiscriminator.Person && Object.hasOwn(author, 'person')
}

interface AuthorKindSource extends AuthorKind {
  discriminator: typeof AuthorDiscriminator.Source
  title: string
  _resourceName: 'authorKindSource'
}

const isAuthorKindSource = (author: AuthorKind): author is AuthorKindSource => {
  return author.discriminator === AuthorDiscriminator.Source && Object.hasOwn(author, 'title')
}

// const modelValue = defineModel<Filter>({ required: true })

const getAuthorDisplayName = (author: AuthorKind) => {
  return isAuthorKindPerson(author)
    ? author.person.fullName + (author.jobDescription.length > 0 ? ` (${author.jobDescription})` : '')
    : isAuthorKindSource(author)
      ? author.title
      : ''
}

const mapToValueObject = (author: AuthorKind) => {
  const title = getAuthorDisplayName(author)

  return {
    title,
    value: author.id,
  }
}

const END_POINT = '/adm/v1/author-kind'

const fetchAuthorListByIds = (ids: IntegerId[]) =>
  apiFetchByIds<AuthorKind[]>(cmsClient, ids, END_POINT + '/search', {}, 'cmw', 'authorKind', undefined, true)

const fetchAuthorList = (pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<AuthorKind[]>(cmsClient, END_POINT, {}, pagination, filterBag, 'cms', 'authorKind')

const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
  const authors = await fetchAuthorList(pagination, filterBag)

  return <ValueObjectOption<IntegerId>[]>authors.map((author: AuthorKind) => mapToValueObject(author))
}

const fetchItemsByIds = async (ids: IntegerId[]) => {
  const authors = await fetchAuthorListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>authors.map((author: AuthorKind) => mapToValueObject(author))
}

const makeFilter = makeFilterHelper('cms', 'authorKind')

const innerFilter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  id: {
    ...makeFilter({ name: 'id' }),
  },
  discriminator: {
    ...makeFilter({ name: 'discriminator' }),
  },
  siteGroup: {
    ...makeFilter({ name: 'siteGroup', field: 'siteGroupId', default: null }),
  },
  text: {
    ...makeFilter({ name: 'text' }),
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
    filter-by-field="text"
  />
</template>
