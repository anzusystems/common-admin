import type {
  UploadQueueItem,
  UploadQueueItemStatusType,
  UploadQueueItemTypeType,
} from '@/domains/dam/types/UploadQueue'
import type { IntegerId } from '@/shared/types/common'
import { DamAssetStatusDefault, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import { AssetFileFailReasonDefault } from '@/domains/dam/types/AssetFile'

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
      latestChunkAbortController: null,
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
      mainFileSingleUse: null,
      mainFileInternal: null,
    }
  }

  return {
    createDefault,
  }
}
