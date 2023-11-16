import type { CancelTokenSource } from 'axios'
import type { DocId, DocIdNullable, IntegerId } from '@/types/common'
import type {
  AssetExternalProviderIdNullable,
  AssetExternalProviderMetadata,
  DamAssetStatus,
  DamAssetType
} from '@/types/coreDam/Asset'
import type { AssetFileFailReason,  AssetFileLink } from '@/types/coreDam/AssetFile'

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

export enum UploadQueueItemType {
  File = 'file',
  Asset = 'asset',
  ExternalProviderAsset = 'externalProviderAsset',
  SlotFile = 'slotFile',
}

export enum UploadQueueItemStatus {
  Loading = 'loading', // loading additional api data
  Waiting = 'waiting', // waiting to be uploaded
  Uploading = 'uploading', // uploading right now
  Processing = 'processing', // all data sent by FE, server processing, waiting for notification, todo
  Failed = 'failed', // any error
  Uploaded = 'uploaded', // uploaded/ready after loading
  Stop = 'stop', // after hitting stop upload
}

export interface UploadQueueItemChunk {
  cancelTokenSource: CancelTokenSource
}

export interface UploadQueueItem {
  key: string
  file: File | null
  status: UploadQueueItemStatus
  assetStatus: DamAssetStatus
  isDuplicate: boolean
  type: UploadQueueItemType
  assetType: DamAssetType
  displayTitle: string
  assetId: DocIdNullable
  duplicateAssetId: DocIdNullable
  fileId: DocIdNullable
  externalProviderAssetId: AssetExternalProviderIdNullable
  externalProviderName: string | null
  externalProviderMetadata: AssetExternalProviderMetadata
  chunks: UploadQueueItemChunk[]
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
    assetFileFailReason: AssetFileFailReason
  }
  notificationFallbackTimer: ReturnType<typeof setTimeout> | undefined
  notificationFallbackTry: number
  slotName: string | null
}

export interface DamUploadStartResponse {
  id: DocId
  asset: DocId
}
