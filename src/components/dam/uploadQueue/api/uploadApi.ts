import { DamAssetType } from '@/types/coreDam/Asset'
import { type DamUploadStartResponse, type UploadQueueItem, UploadQueueItemStatus } from '@/types/coreDam/UploadQueue'
import { imageUploadChunk, imageUploadFinish, imageUploadStart } from '@/components/dam/uploadQueue/api/damImageApi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { AssetFileProcessStatus } from '@/types/coreDam/AssetFile'
import { fetchAsset } from '@/components/dam/uploadQueue/api/damAssetApi'
import { useUploadQueuesStore } from '@/components/dam/uploadQueue/uploadQueuesStore'

const NOTIFICATION_FALLBACK_TIMER_CHECK_SECONDS = 10
const NOTIFICATION_FALLBACK_MAX_TRIES = 3

export const damUploadStart: (client: () => AxiosInstance, item: UploadQueueItem) => Promise<DamUploadStartResponse> = (
  client: () => AxiosInstance,
  item: UploadQueueItem
) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadStart(client, item)
      .then((res) => {
        resolve(res as DamUploadStartResponse)
        return
      })
      .catch((err) => reject(err))
  })
}

export const damUploadChunk = (
  client: () => AxiosInstance,
  item: UploadQueueItem,
  imageId: DocId,
  buffer: string,
  size: number,
  offset: number,
  onUploadProgressCallback: any
) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadChunk(client, item, imageId, buffer, size, offset, onUploadProgressCallback)
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
  item: UploadQueueItem,
  sha: string,
  uploadStatusFallback: boolean
) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadFinish(client, item, sha)
      .then((res) => {
        item.status = UploadQueueItemStatus.Processing
        if (uploadStatusFallback) {
          item.notificationFallbackTimer = setTimeout(function () {
            notificationFallbackCallback(client, item)
          }, calculateFallbackTime(item))
        }
        resolve(res)
      })
      .catch((err) => reject(err))
  })
}

function calculateFallbackTime(item: UploadQueueItem) {
  return NOTIFICATION_FALLBACK_TIMER_CHECK_SECONDS * 1000 * item.notificationFallbackTry * item.notificationFallbackTry
}

async function notificationFallbackCallback(client: () => AxiosInstance, item: UploadQueueItem) {
  clearTimeout(item.notificationFallbackTimer)
  if (item.status === UploadQueueItemStatus.Uploaded) return
  if (item.notificationFallbackTry > NOTIFICATION_FALLBACK_MAX_TRIES) return
  if (!item.assetId) return
  const asset = await fetchAsset(client, item.assetId)
  if (asset && asset.mainFile && asset.mainFile.fileAttributes) {
    const uploadQueuesStore = uploadQueuesStore()
    if (asset.mainFile.fileAttributes.status === AssetFileProcessStatus.Processed) {
      uploadQueuesStore.queueItemProcessed(asset.id)
      return
    } else if (asset.mainFile.fileAttributes.status === AssetFileProcessStatus.Duplicate) {
      uploadQueuesStore.queueItemDuplicate(asset.id)
      return
    } else if (asset.mainFile.fileAttributes.status === AssetFileProcessStatus.Failed) {
      uploadQueuesStore.queueItemFailed(asset.id, asset.mainFile.fileAttributes.failReason)
      return
    }
  }
  item.notificationFallbackTry++
  item.notificationFallbackTimer = setTimeout(function () {
    notificationFallbackCallback(client, item)
  }, calculateFallbackTime(item))
}
