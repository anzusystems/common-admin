import type { DatetimeUTC, DatetimeUTCNullable, DocId, IntegerId, IntegerIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

type JSONContent = any
export enum ArticleDiscriminator {
  Standard = 'standard',
  Minute = 'minute',
  Default = Standard,
}

export enum ArticleStatus {
  Draft = 'draft',
  Ready = 'ready',
  Published = 'published',
  Default = Draft,
}

export interface ArticleHasAuthor {
  id: IntegerId
  author: IntegerId
  position: number
  _resourceName: 'articleHasAuthor'
  _system: 'cms'
}

export enum ArticleResourceName {
  Standard = 'articleKindStandard',
  Minute = 'articleKindMinute',
  Default = Standard,
}

export interface ArticleKind extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  discriminator: ArticleDiscriminator
  docId: DocId
  status: ArticleStatus
  texts: ArticleTexts
  dates: ArticleDates
  leadImage: IntegerIdNullable
  listingImage: IntegerIdNullable
  socialImage: IntegerIdNullable
  site: IntegerId
  mainRubric: IntegerId
  articleAuthors: ArticleHasAuthor[]
  owners: IntegerId[]
  keywords: IntegerId[]
  legacy: ArticleLegacy
  customData: any
  _system: 'cms'
  _resourceName: ArticleResourceName
}

export interface ArticleTexts {
  title: string
  seoTitle: string
  subTitle: string
  leadText: string
  seoLeadText: string
  body: JSONContent
}

export interface ArticleDates {
  publishedAt: DatetimeUTCNullable
  firstPublishedAt: DatetimeUTCNullable
  expireAt: DatetimeUTCNullable
  publicPublishedAt: DatetimeUTC
  publicUpdatedAt: DatetimeUTCNullable
}

export interface ArticleFlags {
  enableAds: boolean
  enableAdsInContent: boolean
}

export interface ArticleLegacy {
  author: string | null
}
