import type { UploadQueueItem, UploadQueueItemStatusType, UploadQueueItemTypeType } from '@/types/coreDam/UploadQueue'
import type { IntegerId } from '@/types/common'
import { DamAssetStatusDefault, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { AssetFileFailReasonDefault } from '@/types/coreDam/AssetFile'

export function useUploadQueueItemFactory() {
  const createDefault = (
    key: string,
    type: UploadQueueItemTypeType,
    status: UploadQueueItemStatusType,
    assetType: DamAssetTypeType,
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
      assetStatus: DamAssetStatusDefault,
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
      latestChunkCancelToken: null,
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
        assetFileFailReason: AssetFileFailReasonDefault,
      },
      notificationFallbackTimer: undefined,
      notificationFallbackTry: 1,
      slotName: null,
      image: undefined,
    }
  }

  return {
    createDefault,
  }
}
