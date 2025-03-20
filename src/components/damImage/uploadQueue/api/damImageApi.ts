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

const COPY_TO_LICENCE_MAX_LIMIT = 50
const COPY_TO_LICENCE_API_LIMIT = 1 // todo back to 20

export const copyToLicence = async (
  client: () => AxiosInstance,
  items: DamImageCopyToLicenceRequest
): Promise<DamImageCopyToLicenceResponse> => {
  if (items.length > COPY_TO_LICENCE_MAX_LIMIT) {
    return Promise.reject('Exceeded max limit')
  }

  const url = END_POINT + '/copy-to-licence'

  const chunkArray = <T>(arr: T[], chunkSize: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
      arr.slice(i * chunkSize, i * chunkSize + chunkSize)
    )
  }

  const itemChunks = chunkArray(items, COPY_TO_LICENCE_API_LIMIT)

  try {
    const responses = await Promise.all(
      itemChunks.map((chunk) =>
        client()
          .patch(url, JSON.stringify(chunk))
          .then((res) => (res.status === HTTP_STATUS_OK ? res.data : []))
      )
    )

    return responses.flat()
  } catch (error) {
    return Promise.reject(error)
  }
}
