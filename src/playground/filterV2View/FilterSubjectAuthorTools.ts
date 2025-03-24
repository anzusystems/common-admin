import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import type { Pagination } from '@/types/Pagination'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/v2/apiFetchList.ts'
import { createFilter, type FilterConfig, type FilterData } from '@/composables/filter/filterFactory.ts'

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
  apiFetchByIds<AuthorKind[]>(cmsClient, ids, END_POINT + '/search', {}, 'cmw', 'authorKind', undefined, true)

const fetchAuthorList = (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) =>
  apiFetchList<AuthorKind[]>(cmsClient, END_POINT, {}, pagination, filterData, filterConfig, 'cms', 'authorKind')

export const fetchItems = async (
  pagination: Pagination,
  filterData: FilterData,
  filterConfig: FilterConfig
) => {
  const authors = await fetchAuthorList(pagination, filterData, filterConfig)

  return <ValueObjectOption<IntegerId>[]>authors.map((author: AuthorKind) => mapToValueObject(author))
}

export const fetchItemsByIds = async (ids: IntegerId[]) => {
  const authors = await fetchAuthorListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>authors.map((author: AuthorKind) => mapToValueObject(author))
}

export function useSubjectAuthorInnerFilter() {
  const { filterConfig, filterData } = createFilter(
    [
      { name: 'id' as const, default: null },
      { name: 'discriminator' as const, default: null },
      { name: 'siteGroup' as const, field: 'siteGroupId', default: null },
      { name: 'text' as const, default: null },
    ],
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
