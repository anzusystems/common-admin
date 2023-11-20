import { type EventBusKey, useEventBus } from '@vueuse/core'
import type { DocId, DocIdNullable } from '@/types/common'
import type { AssetFileFailReason } from '@/types/coreDam/AssetFile'
import type { DamAssetType, DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { DamDistributionStatus } from '@/types/coreDam/DamConfig'

export const DamNotificationName = {
  AssetFileProcessed: 'asset_file_processed',
  AssetFileFailed: 'asset_file_failed',
  AssetFileDuplicate: 'asset_file_duplicate',
  AssetMetadataProcessed: 'asset_metadata_processed',
  DistributionDistributing: 'distribution_distributing',
  DistributionRemoteProcessing: 'distribution_remote_processing',
  DistributionDistributed: 'distribution_distributed',
  DistributionFailed: 'distribution_failed',
  DistributionAuthorized: 'distribution_authorized',
  UserUpdated: 'user_updated',
} as const

export type DamNotificationNameType = (typeof DamNotificationName)[keyof typeof DamNotificationName]

type DamNotificationEvent<T extends DamNotificationNameType, P> = {
  name: T
  data: P
}

type DamNotificationAssetFileProcessed = DamNotificationEvent<
  typeof DamNotificationName.AssetFileProcessed,
  {
    assetId: DocId
  }
>
type DamNotificationAssetFileFailed = DamNotificationEvent<
  typeof DamNotificationName.AssetFileFailed,
  {
    assetId: DocId
    failReason: AssetFileFailReason
  }
>
type DamNotificationAssetFileDuplicate = DamNotificationEvent<
  typeof DamNotificationName.AssetFileDuplicate,
  {
    assetId: DocId
    originAssetFile: DocIdNullable
    assetType: DamAssetType | null
  }
>
type DamNotificationAssetMetadataProcessed = DamNotificationEvent<
  typeof DamNotificationName.AssetMetadataProcessed,
  {
    assetId: DocId
  }
>

type DamNotificationDistributionDistributing = DamNotificationEvent<
  typeof DamNotificationName.DistributionDistributing,
  {
    distributionId: DocId
    status: DamDistributionStatus
  }
>

type DamNotificationDistributionRemoteProcessing = DamNotificationEvent<
  typeof DamNotificationName.DistributionRemoteProcessing,
  {
    distributionId: DocId
    status: DamDistributionStatus
  }
>

type DamNotificationDistributionDistributed = DamNotificationEvent<
  typeof DamNotificationName.DistributionDistributed,
  {
    distributionId: DocId
    status: DamDistributionStatus
  }
>

type DamNotificationDistributionFailed = DamNotificationEvent<
  typeof DamNotificationName.DistributionFailed,
  {
    distributionId: DocId
    status: DamDistributionStatus
  }
>

type DamNotificationDistributionAuthorized = DamNotificationEvent<
  typeof DamNotificationName.DistributionAuthorized,
  {
    distributionService: DamDistributionServiceName
    success: boolean
  }
>

type DamNotificationUserUpdated = DamNotificationEvent<typeof DamNotificationName.UserUpdated, undefined>

export type DamNotification =
  | DamNotificationAssetFileProcessed
  | DamNotificationAssetFileFailed
  | DamNotificationAssetFileDuplicate
  | DamNotificationAssetMetadataProcessed
  | DamNotificationDistributionDistributing
  | DamNotificationDistributionRemoteProcessing
  | DamNotificationDistributionDistributed
  | DamNotificationDistributionFailed
  | DamNotificationDistributionAuthorized
  | DamNotificationUserUpdated

export const damNotificationsEventBusKey: EventBusKey<DamNotification> = Symbol('anzu:damNotificationsEventBusKey')

export function useDamNotificationsEventBus() {
  return useEventBus<DamNotification>(damNotificationsEventBusKey)
}
