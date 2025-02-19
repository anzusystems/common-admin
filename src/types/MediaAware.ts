import type { DocIdNullable, IntegerId } from '@/types/common.ts'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export interface MediaAware extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  extService: MediaExtServiceType
  dam: DamMedia
}

export interface DamMedia {
  imageFileId: DocIdNullable
  assetId: DocIdNullable
  licenceId: IntegerId
}

export const MediaExtService = {
  DamVideo: 'damVideo',
  DamPodcast: 'damAudio',
} as const
export type MediaExtServiceType = (typeof MediaExtService)[keyof typeof MediaExtService]
export const MediaExtServiceDefault = MediaExtService.DamVideo
