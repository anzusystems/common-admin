import type { DocIdNullable, IntegerId, IntegerIdNullable } from '@/types/common'

export interface MediaAware {
  id?: IntegerId
  damMedia: DamMedia
  siteGroup: IntegerIdNullable
}

export interface DamMedia {
  imageFileId: DocIdNullable
  assetId: DocIdNullable
  licenceId: IntegerIdNullable
  readonly assetType: DamMediaTypeType
  // readonly title: string
  // readonly description: string
  // readonly seriesName: string
  // readonly authorNames: string[]
  // readonly publishedAt: DatetimeUTCNullable
  // readonly duration: number
  // readonly mediaUrl: string | null
  // readonly playable: boolean
  // readonly episodeName: string
  // readonly episodeNumber: number | null
}

export const DamMediaType = {
  Audio: 'audio',
  Video: 'video'
} as const
export type DamMediaTypeType = (typeof DamMediaType)[keyof typeof DamMediaType]
