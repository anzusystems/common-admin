import type { CancelTokenSource } from 'axios'
import type { DocId, DocIdNullable, IntegerId } from '@/types/common'
import type {
  AssetExternalProviderIdNullable,
  AssetExternalProviderMetadata,
  DamAssetStatusType,
  DamAssetTypeType,
} from '@/types/coreDam/Asset'
import type { AssetFileFailReasonType, AssetFileLink } from '@/types/coreDam/AssetFile'
import type { ImageAware } from '@/types/ImageAware'

export type UploadQueueKey = string

export interface UploadQueue {
  items: UploadQueueItem[]
  totalCount: number
  processedCount: number
  fileInputKey: number // used to reset html input file element

  suggestions: {
    newKeywordNames: Set<string>
    newAuthorNames: Set<string>
  }
}

export const UploadQueueItemType = {
  File: 'file',
  Asset: 'asset',
  ExternalProviderAsset: 'externalProviderAsset',
  SlotFile: 'slotFile',
} as const
export type UploadQueueItemTypeType = (typeof UploadQueueItemType)[keyof typeof UploadQueueItemType]

export const UploadQueueItemStatus = {
  Loading: 'loading', // loading additional api data
  Waiting: 'waiting', // waiting to be uploaded
  Uploading: 'uploading', // uploading right now
  Processing: 'processing', // all data sent by FE, server processing, waiting for notification, todo
  Failed: 'failed', // any error
  Uploaded: 'uploaded', // uploaded/ready after loading
  Stop: 'stop', // after hitting stop upload
} as const
export type UploadQueueItemStatusType = (typeof UploadQueueItemStatus)[keyof typeof UploadQueueItemStatus]

export interface UploadQueueItem {
  key: string
  file: File | null
  status: UploadQueueItemStatusType
  assetStatus: DamAssetStatusType
  isDuplicate: boolean
  type: UploadQueueItemTypeType
  assetType: DamAssetTypeType
  displayTitle: string
  assetId: DocIdNullable
  duplicateAssetId: DocIdNullable
  fileId: DocIdNullable
  externalProviderAssetId: AssetExternalProviderIdNullable
  externalProviderName: string | null
  externalProviderMetadata: AssetExternalProviderMetadata
  latestChunkCancelToken: CancelTokenSource | null
  chunkSize: number
  currentChunkIndex: number
  chunkTotalCount: number
  licenceId: IntegerId
  imagePreview?: AssetFileLink
  canEditMetadata: boolean
  keywords: DocId[]
  authors: DocId[]
  customData: any
  authorConflicts: DocId[]
  progress: {
    remainingTime: null | number
    progressPercent: null | number
    speed: null | number
  }
  error: {
    hasError: boolean
    message: string
    assetFileFailReason: AssetFileFailReasonType
  }
  notificationFallbackTimer: ReturnType<typeof setTimeout> | undefined
  notificationFallbackTry: number
  slotName: string | null
  image: undefined | ImageAware // todo check
}

export interface DamUploadStartResponse {
  id: DocId
  asset: DocId
}
