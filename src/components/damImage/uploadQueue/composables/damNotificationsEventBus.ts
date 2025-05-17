import { type EventBusKey, useEventBus } from '@vueuse/core'
import type { DocId } from '@/types/common'
import type { AssetFileFailReasonType, AssetFileProcessStatusType } from '@/types/coreDam/AssetFile'
import type { DamAssetTypeType, DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { DamDistributionStatusType } from '@/types/coreDam/DamConfig'

export const damNotificationsEventBusKey: EventBusKey<DamNotification> = Symbol('anzu:damNotificationsEventBusKey')

export function useDamNotificationsEventBus() {
  return useEventBus<DamNotification>(damNotificationsEventBusKey)
}

export const DamNotificationName = {
  AssetFileProcessed: 'asset_file_processed',
  AssetFileFailed: 'asset_file_failed',
  AssetFileDuplicate: 'asset_file_duplicate',
  AssetFileUploaded: 'asset_file_uploaded',
  AssetFileDeleted: 'asset_file_deleted',
  AssetMetadataProcessed: 'asset_metadata_processed',
  AssetDeleted: 'asset_deleted',
  DistributionDistributing: 'distribution_distributing',
  DistributionRemoteProcessing: 'distribution_remote_processing',
  DistributionDistributed: 'distribution_distributed',
  DistributionFailed: 'distribution_failed',
  DistributionAuthorized: 'distribution_authorized',
  UserUpdated: 'user_updated',
  AssetFileCopied: 'asset_file_copied',
} as const

export type DamNotificationNameType = (typeof DamNotificationName)[keyof typeof DamNotificationName]

type DamNotificationEvent<T extends DamNotificationNameType, P> = {
  name: T
  data: P
}

interface DamNotificationAssetFileData {
  id: DocId
  asset: DocId
}

interface DamNotificationAssetFileStatusData {
  id: DocId
  asset: DocId
  status: AssetFileProcessStatusType
  failReason: AssetFileFailReasonType
  assetType: DamAssetTypeType
  originAssetFile: DocId
}

interface DamNotificationDistributionData {
  id: DocId
  asset: DocId
  assetFile: DocId
  status: DamDistributionStatusType
}

interface DamNotificationAssetData {
  asset: DocId
}

type DamNotificationAssetFileProcessed = DamNotificationEvent<
  typeof DamNotificationName.AssetFileProcessed,
  DamNotificationAssetFileStatusData
>

type DamNotificationAssetFileFailed = DamNotificationEvent<
  typeof DamNotificationName.AssetFileFailed,
  DamNotificationAssetFileStatusData
>

type DamNotificationAssetFileDuplicate = DamNotificationEvent<
  typeof DamNotificationName.AssetFileDuplicate,
  DamNotificationAssetFileStatusData
>

type DamNotificationAssetFileUploaded = DamNotificationEvent<
  typeof DamNotificationName.AssetFileUploaded,
  DamNotificationAssetFileStatusData
>

type DamNotificationAssetFileDeleted = DamNotificationEvent<
  typeof DamNotificationName.AssetFileDeleted,
  DamNotificationAssetFileData
>

type DamNotificationAssetMetadataProcessed = DamNotificationEvent<
  typeof DamNotificationName.AssetMetadataProcessed,
  DamNotificationAssetFileStatusData
>

type DamNotificationAssetDeleted = DamNotificationEvent<
  typeof DamNotificationName.AssetDeleted,
  DamNotificationAssetData
>

type DamNotificationDistributionDistributing = DamNotificationEvent<
  typeof DamNotificationName.DistributionDistributing,
  DamNotificationDistributionData
>

type DamNotificationDistributionRemoteProcessing = DamNotificationEvent<
  typeof DamNotificationName.DistributionRemoteProcessing,
  DamNotificationDistributionData
>

type DamNotificationDistributionDistributed = DamNotificationEvent<
  typeof DamNotificationName.DistributionDistributed,
  DamNotificationDistributionData
>

type DamNotificationDistributionFailed = DamNotificationEvent<
  typeof DamNotificationName.DistributionFailed,
  DamNotificationDistributionData
>

type DamNotificationDistributionAuthorized = DamNotificationEvent<
  typeof DamNotificationName.DistributionAuthorized,
  {
    distributionService: DamDistributionServiceName
    success: boolean
  }
>

type DamNotificationUserUpdated = DamNotificationEvent<typeof DamNotificationName.UserUpdated, undefined>

type DamNotificationAssetFileCopied = DamNotificationEvent<
  typeof DamNotificationName.AssetFileCopied,
  DamNotificationAssetFileStatusData
>

export type DamNotification =
  | DamNotificationAssetFileProcessed
  | DamNotificationAssetFileFailed
  | DamNotificationAssetFileDuplicate
  | DamNotificationAssetFileUploaded
  | DamNotificationAssetFileDeleted
  | DamNotificationAssetMetadataProcessed
  | DamNotificationAssetDeleted
  | DamNotificationDistributionDistributing
  | DamNotificationDistributionRemoteProcessing
  | DamNotificationDistributionDistributed
  | DamNotificationDistributionFailed
  | DamNotificationDistributionAuthorized
  | DamNotificationUserUpdated
  | DamNotificationAssetFileCopied
