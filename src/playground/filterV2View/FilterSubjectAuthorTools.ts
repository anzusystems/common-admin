import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
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

const fetchAuthorListByIds = (ids: IntegerId[]) => {
  const { executeFetch } = useApiFetchByIds<AuthorKind[]>(cmsClient, 'cms', 'authorKind', undefined, true)
  return executeFetch(ids, END_POINT + '/search')
}

const useFetchAuthorList = () => useApiFetchList<AuthorKind[]>(cmsClient, 'cms', 'authorKind')

export const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const { executeFetch } = useFetchAuthorList()
  const authors = await executeFetch(pagination, filterData, filterConfig, END_POINT + '/search')

  return <ValueObjectOption<IntegerId>[]>authors.map((author: AuthorKind) => mapToValueObject(author))
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const authors = await fetchAuthorListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>authors.map((author: AuthorKind) => mapToValueObject(author))
}

export function useSubjectAuthorInnerFilter() {
  const filterFields = [
    { name: 'id' as const },
    { name: 'discriminator' as const },
    { name: 'siteGroup' as const, apiName: 'siteGroupId' },
    { name: 'text' as const },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(
    filterFields,
    reactive<FilterStore<{ name: (typeof filterFields)[number]['name'] }[]>>({
      id: null,
      discriminator: null,
      siteGroup: null,
      text: null,
    }),
    {
      elastic: true,
      system: 'cms',
      subject: 'authorKind',
    }
  )

  return {
    filterConfig,
    filterData,
  }
}
