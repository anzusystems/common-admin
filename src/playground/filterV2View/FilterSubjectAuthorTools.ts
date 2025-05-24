import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { Pagination2 } from '@/types/Pagination'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds2 } from '@/services/api/v2/apiFetchByIds2'
import { apiFetchList2 } from '@/services/api/v2/apiFetchList2'
import {
  createFilter,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
} from '@/composables/filter/filterFactory'
import { reactive, type Ref } from 'vue'

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

const fetchAuthorListByIds = (ids: IntegerId[]) =>
  apiFetchByIds2<AuthorKind[]>(cmsClient, ids, END_POINT + '/search', {}, 'cms', 'authorKind', undefined, true)

const fetchAuthorList = (pagination: Ref<Pagination2>, filterData: FilterData, filterConfig: FilterConfig) =>
  apiFetchList2<AuthorKind[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'authorKind')

export const fetchItems = async (pagination: Ref<Pagination2>, filterData: FilterData, filterConfig: FilterConfig) => {
  const authors = await fetchAuthorList(pagination, filterData, filterConfig)

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
