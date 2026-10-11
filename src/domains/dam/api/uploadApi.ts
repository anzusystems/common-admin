import { DamAssetType } from '@/domains/dam/types/Asset'
import {
  type DamUploadStartResponse,
  type UploadQueueItem,
  UploadQueueItemStatus,
} from '@/domains/dam/types/UploadQueue'
import { imageUploadChunk, imageUploadFinish, imageUploadStart } from '@/domains/dam/api/damImageApi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/shared/types/common'

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
  endPointImage: string,
  item: UploadQueueItem,
  sha: string
) => {
  return new Promise((resolve, reject) => {
    if (item.assetType !== DamAssetType.Image) {
      reject()
      return
    }
    imageUploadFinish(client, endPointImage, item, sha)
      .then((res) => {
        // Only an item still sending. One stopped while the finish request ran, which has nothing to cancel, stays
        // stopped; one its notification has settled meanwhile stays settled.
        if (item.status === UploadQueueItemStatus.Uploading) item.status = UploadQueueItemStatus.Processing
        resolve(res)
      })
      .catch((err) => reject(err))
  })
}
