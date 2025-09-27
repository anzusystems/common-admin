import type { DatetimeUTCNullable, DocId, DocIdNullable, IntegerId, IntegerIdNullable } from '@/types/common'

export interface MediaAware<T extends DamMedia = DamMedia> extends MediaEntity {
  id?: IntegerId
  damMedia: T
  siteGroup: IntegerIdNullable
  extService: 'damVideo' | 'damAudio'
}

export interface DamMedia {
  imageFileId: DocIdNullable
  assetId: DocIdNullable
  licenceId: IntegerIdNullable
  readonly assetType: DamMediaTypeType
  readonly title: string
  readonly description: string
  readonly seriesName: string
  readonly authorNames: string[]
  readonly publishedAt: DatetimeUTCNullable
  readonly duration: number
  readonly mediaUrl: string | null
  readonly playable: boolean
  readonly syncedWithDam: boolean
  readonly episodeName: string
  readonly episodeNumber: number | null
}

export const DamMediaType = {
  Audio: 'audio',
  Video: 'video'
} as const
export type DamMediaTypeType = (typeof DamMediaType)[keyof typeof DamMediaType]

export type DamMediaFromDam = Omit<DamMedia, 'syncedWithDam'>

export const MediaEntity = {
  Article: 'articleKindStandard',
} as const

export type MediaEntityType = (typeof MediaEntity)[keyof typeof MediaEntity]

export type MediaEntityKey = MediaEntityType

export type MediaEntity = {
  [key in MediaEntityKey]: IntegerId | DocId | null
}
