import type { AxiosInstance } from 'axios'
import { type UploadQueueItem, UploadQueueItemType } from '@/types/coreDam/UploadQueue'
import type { DocId } from '@/types/common'
import { HTTP_STATUS_CREATED, HTTP_STATUS_OK } from '@/composables/statusCodes'
import { damFileTypeFix } from '@/components/file/composables/fileType'
import type { AssetFileImage } from '@/types/coreDam/AssetFile'
import { apiFetchOne } from '@/services/api/apiFetchOne'

import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamImageCopyToLicenceRequest, DamImageCopyToLicenceResponse } from '@/types/coreDam/Asset.ts'

const END_POINT = '/adm/v1/image'
const CHUNK_UPLOAD_TIMEOUT = 420

export const fetchImageFile = (client: () => AxiosInstance, id: DocId) =>
  apiFetchOne<AssetFileImage>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, 'asset')

export const imageUploadStart = (client: () => AxiosInstance, item: UploadQueueItem) => {
  return new Promise((resolve, reject) => {
    let url = END_POINT + '/licence/' + item.licenceId
    if (item.type === UploadQueueItemType.SlotFile && item.slotName && item.assetId) {
      url = END_POINT + '/asset/' + item.assetId + '/slot-name/' + item.slotName
    }
    client()
      .post(
        url,
        JSON.stringify({
          mimeType: damFileTypeFix(item.file),
          size: item.file?.size,
        })
      )
      .then((res) => {
        if (res.status === HTTP_STATUS_CREATED) {
          resolve(res.data)
        } else {
          //
          reject()
        }
      })
      .catch((err) => {
        //
        reject(err)
      })
  })
}

export const imageUploadChunk = (
  client: (timeout?: number) => AxiosInstance,
  item: UploadQueueItem,
  imageId: DocId,
  buffer: string,
  size: number,
  offset: number,
  onUploadProgressCallback: ((progressEvent: any) => void) | undefined = undefined
) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    const url = END_POINT + '/' + imageId + '/chunk'
    formData.append('file', buffer)
    formData.append(
      'chunk',
      JSON.stringify({
        offset: offset,
        size: size,
      })
    )

    client(CHUNK_UPLOAD_TIMEOUT)
      .post(url, formData, {
        cancelToken: item.latestChunkCancelToken ? item.latestChunkCancelToken.token : undefined,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: onUploadProgressCallback,
      })
      .then((res) => {
        if (res.status === HTTP_STATUS_CREATED) {
          resolve(res.data)
        } else {
          //
          reject()
        }
      })
      .catch((err) => {
        //
        reject(err)
      })
  })
}

export const imageUploadFinish = (client: () => AxiosInstance, item: UploadQueueItem, sha: string) => {
  return new Promise((resolve, reject) => {
    const url = END_POINT + '/' + item.fileId + '/uploaded'
    client()
      .patch(
        url,
        JSON.stringify({
          checksum: sha,
        })
      )
      .then((res) => {
        if (res.status === HTTP_STATUS_OK) {
          resolve(res.data)
        } else {
          //
          reject()
        }
      })
      .catch((err) => {
        //
        reject(err)
      })
  })
}

export const rotateImage = (client: () => AxiosInstance, imageId: DocId, angle: 90 | 270) => {
  return new Promise((resolve, reject) => {
    const url = END_POINT + '/' + imageId + '/rotate/' + angle
    client()
      .patch(url)
      .then((res) => {
        if (res.status === HTTP_STATUS_OK) {
          resolve(res.data)
        } else {
          //
          reject()
        }
      })
      .catch((err) => {
        //
        reject(err)
      })
  })
}

export const copyToLicence = (client: () => AxiosInstance, items: DamImageCopyToLicenceRequest) => {
  return new Promise<DamImageCopyToLicenceResponse>((resolve, reject) => {
    const url = END_POINT + '/copy-to-licence'
    client()
      .patch(url, JSON.stringify(items))
      .then((res) => {
        if (res.status === HTTP_STATUS_OK) {
          resolve(res.data)
        } else {
          reject()
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}
