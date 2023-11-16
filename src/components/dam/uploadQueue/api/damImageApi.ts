import type { AxiosInstance } from 'axios'
import { type UploadQueueItem, UploadQueueItemType } from '@/types/coreDam/UploadQueue'
import type { DocId } from '@/types/common'
import { HTTP_STATUS_CREATED, HTTP_STATUS_OK } from '@/composables/statusCodes'
import { damFileTypeFix } from '@/components/file/composables/fileType'

const END_POINT = '/adm/v1/image'
const CHUNK_UPLOAD_TIMEOUT = 420

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
        cancelToken:
          item.chunks[item.currentChunkIndex] && item.chunks[item.currentChunkIndex].cancelTokenSource
            ? item.chunks[item.currentChunkIndex].cancelTokenSource.token
            : undefined,
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
