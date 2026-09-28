import { DamAssetType } from '@/domains/dam/types/Asset'
import {
  type DamUploadStartResponse,
  type UploadQueueItem,
  UploadQueueItemStatus,
} from '@/domains/dam/types/UploadQueue'
import { imageUploadChunk, imageUploadFinish, imageUploadStart } from '@/domains/dam/api/damImageApi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/shared/types/common'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { fetchAsset } from '@/domains/dam/api/damAssetApi'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { commonT } from '@/plugins/i18n'

const NOTIFICATION_FALLBACK_TIMER_CHECK_SECONDS = 10
const NOTIFICATION_FALLBACK_MAX_TRIES = 4

export const damUploadStart: (
  client: () => AxiosInstance,
  endPoint: string,
  item: UploadQueueItem
) => Promise<DamUploadStartResponse> = (client: () => AxiosInstance, endPoint: string, item: UploadQueueItem) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadStart(client, endPoint, item)
      .then((res) => {
        resolve(res as DamUploadStartResponse)
        return
      })
      .catch((err) => reject(err))
  })
}

export const damUploadChunk = (
  client: () => AxiosInstance,
  endPoint: string,
  item: UploadQueueItem,
  imageId: DocId,
  buffer: Blob | File,
  size: number,
  offset: number,
  onUploadProgressCallback: any
) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadChunk(client, endPoint, item, imageId, buffer, size, offset, onUploadProgressCallback)
      .then((res) => {
        resolve(res)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export const damUploadFinish = (
  client: () => AxiosInstance,
  endPointAsset: string,
  endPointImage: string,
  item: UploadQueueItem,
  sha: string,
  uploadStatusFallback: boolean
) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadFinish(client, endPointImage, item, sha)
      .then((res) => {
        item.status = UploadQueueItemStatus.Processing
        if (uploadStatusFallback) armNotificationFallback(client, endPointAsset, item)
        resolve(res)
      })
      .catch((err) => reject(err))
  })
}

export const armNotificationFallback = (client: () => AxiosInstance, endPointAsset: string, item: UploadQueueItem) => {
  clearTimeout(item.notificationFallbackTimer)
  item.notificationFallbackTimer = setTimeout(function () {
    notificationFallbackCallback(client, endPointAsset, item)
  }, calculateFallbackTime(item))
}

function calculateFallbackTime(item: UploadQueueItem) {
  return NOTIFICATION_FALLBACK_TIMER_CHECK_SECONDS * 1000 * item.notificationFallbackTry * item.notificationFallbackTry
}

async function notificationFallbackCallback(client: () => AxiosInstance, endPoint: string, item: UploadQueueItem) {
  clearTimeout(item.notificationFallbackTimer)
  if (item.status === UploadQueueItemStatus.Uploaded) return
  if (item.notificationFallbackTry > NOTIFICATION_FALLBACK_MAX_TRIES) {
    item.error.hasError = true
    item.error.message = commonT('common.damImage.uploadErrors.processingTooLong')
    return
  }
  if (!item.assetId) return
  let asset: Awaited<ReturnType<typeof fetchAsset>> | undefined = undefined
  try {
    asset = await fetchAsset(client, endPoint, item.assetId)
  } catch {
    // One failed request must not end the polling: the next attempt is scheduled below.
  }
  // Awaited: these fetch the asset again and swallow a failure, which leaves the item processing.
  if (asset && asset.mainFile && asset.mainFile.fileAttributes) {
    const uploadQueuesStore = useUploadQueuesStore()
    if (asset.mainFile.fileAttributes.status === AssetFileProcessStatus.Processed) {
      await uploadQueuesStore.queueItemFullyProcessed(asset.id)
    } else if (asset.mainFile.fileAttributes.status === AssetFileProcessStatus.Duplicate) {
      await uploadQueuesStore.queueItemDuplicate(asset.id, asset.mainFile.originAssetFile, asset.attributes.assetType)
    } else if (asset.mainFile.fileAttributes.status === AssetFileProcessStatus.Failed) {
      await uploadQueuesStore.queueItemFailed(asset.id, asset.mainFile.fileAttributes.failReason)
    }
  }
  // Settled by the above, by the notification meanwhile, or stopped: nothing left to poll for.
  if (item.status !== UploadQueueItemStatus.Processing) return
  item.notificationFallbackTry++
  armNotificationFallback(client, endPoint, item)
}
