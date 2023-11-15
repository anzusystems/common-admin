import type { UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/types/coreDam/UploadQueue'
import type { IntegerId } from '@/types/common'
import { DamAssetStatus, type DamAssetType } from '@/types/coreDam/Asset'
import { AssetFileFailReason } from '@/types/coreDam/AssetFile'

export function useUploadQueueItemFactory() {
  const createDefault = (
    key: string,
    type: UploadQueueItemType,
    status: UploadQueueItemStatus,
    assetType: DamAssetType,
    chunkSize: number,
    licenceId: IntegerId
  ): UploadQueueItem => {
    return {
      key: key,
      type: type,
      file: null,
      status: status,
      isDuplicate: false,
      duplicateAssetId: null,
      assetType: assetType,
      assetStatus: DamAssetStatus.Default,
      displayTitle: '',
      assetId: null,
      fileId: null,
      externalProviderAssetId: null,
      externalProviderName: null,
      externalProviderMetadata: {},
      keywords: [],
      authors: [],
      authorConflicts: [],
      customData: {},
      chunks: [],
      chunkSize: chunkSize,
      currentChunkIndex: 0,
      chunkTotalCount: 0,
      licenceId: licenceId,
      imagePreview: undefined,
      progress: {
        remainingTime: null,
        progressPercent: null,
        speed: null,
      },
      canEditMetadata: false,
      error: {
        hasError: false,
        message: '',
        assetFileFailReason: AssetFileFailReason.Default,
      },
      notificationFallbackTimer: undefined,
      notificationFallbackTry: 1,
      slotName: null,
    }
  }

  return {
    createDefault,
  }
}
