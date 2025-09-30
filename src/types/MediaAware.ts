import type { DatetimeUTCNullable, DocIdNullable, IntegerId, IntegerIdNullable } from '@/types/common'

export interface MediaAware<T extends DamMedia = DamMedia> {
  id?: IntegerId
  damMedia: T
  extService: 'damVideo' | 'damAudio'
}

export interface DamMedia {
  imageFileId: DocIdNullable
  assetId: DocIdNullable
  licenceId: IntegerIdNullable
  assetType: DamMediaTypeType
  title: string
  description: string
  seriesName: string
  authorNames: string[]
  publishedAt: DatetimeUTCNullable
  duration: number
  mediaUrl: string | null
  playable: boolean
  syncedWithDam: boolean
  episodeName: string
  episodeNumber: number | null
}

export const DamMediaType = {
  Audio: 'audio',
  Video: 'video',
} as const
export type DamMediaTypeType = (typeof DamMediaType)[keyof typeof DamMediaType]

export type DamMediaFromDam = Omit<DamMedia, 'syncedWithDam'>
