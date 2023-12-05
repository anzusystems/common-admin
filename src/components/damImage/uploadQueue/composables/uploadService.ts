import { ref } from 'vue'
import sha1 from 'js-sha1'
import type { CancelTokenSource } from 'axios'
import axios from 'axios'
import { i18n } from '@/plugins/i18n'
import {
  type AnzuApiValidationResponseData,
  axiosErrorResponseHasValidationData,
} from '@/model/error/AnzuApiValidationError'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/types/coreDam/UploadQueue'
import { NEW_LINE_MARK } from '@/composables/system/alerts'
import { isUndefined } from '@/utils/common'
import { useDamUploadChunkSize } from '@/components/damImage/uploadQueue/composables/damUploadChunkSize'
import { damUploadChunk, damUploadFinish, damUploadStart } from '@/components/damImage/uploadQueue/api/uploadApi'
import {
  useCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

// const CHUNK_MAX_RETRY = 6
const CHUNK_MAX_RETRY = 4
const SPEED_CHECK_INTERVAL = 1000
const CHUNK_RETRY_INTERVAL = 1000
const CHUNK_RETRY_MULTIPLY = 3

const failUpload = async (queueItem: UploadQueueItem, error: unknown = null) => {
  throw error
}

const finishUpload = async (queueItem: UploadQueueItem, sha: string) => {
  const { damClient } = useCommonAdminCoreDamOptions()
  const { uploadStatusFallback } = useCommonAdminCoreDamOptionsGlobal()
  return await damUploadFinish(damClient, queueItem, sha, uploadStatusFallback)
}

const handleValidationErrorMessage = (error: Error | any) => {
  const { t } = i18n.global || i18n
  if (!error || !error.response || !error.response.data) {
    // @ts-ignore
    return t('common.damImage.uploadErrors.unknownError')
  }
  const data = error.response.data as AnzuApiValidationResponseData
  const errorMessages: string[] = []
  for (const [key, values] of Object.entries(data.fields)) {
    switch (key) {
      case 'size':
        errorMessages.push(t('common.damImage.uploadErrors.size'))
        break
      case 'offset':
        errorMessages.push(t('common.damImage.uploadErrors.offset'))
        break
      case 'mimeType':
        errorMessages.push(t('common.damImage.uploadErrors.mimeType'))
        break
      default:
        // @ts-ignore
        errorMessages.push(t('common.damImage.uploadErrors.systemError') + ': ' + key + ' - ' + values.join(','))
    }
  }
  return errorMessages.length > 0 ? errorMessages.join(NEW_LINE_MARK) : t('common.damImage.uploadErrors.unknownError')
}

const readFile = async (offset: number, size: number, file: File): Promise<{ data: string; offset: number }> => {
  return new Promise((resolve, reject) => {
    const partial = file.slice(offset, offset + size)
    const reader = new FileReader()
    reader.onload = function (e) {
      if (e.target?.readyState === FileReader.DONE) {
        resolve({ data: e.target.result as string, offset: offset })
      }
    }
    reader.onerror = function (e) {
      reject(e)
    }
    reader.readAsArrayBuffer(partial)
  })
}

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useUpload(queueItem: UploadQueueItem, uploadCallback: any = undefined) {
  const { damClient } = useCommonAdminCoreDamOptions()
  const fileSize = ref(0)

  const progress = ref(0)

  let speedStack: any[] = []
  let lastTimestamp = 0
  let endTimestamp = 0
  let lastLoaded = 0
  const assetAlgo = sha1.create()
  const { updateChunkSize, lastChunkSize } = useDamUploadChunkSize()

  const getCurrentTimestamp = () => {
    return Date.now() / 1000
  }

  // @ts-ignore
  function progressCallback(progressEvent) {
    const currentStamp = getCurrentTimestamp()
    if (lastTimestamp === 0) {
      lastTimestamp = currentStamp

      return
    }

    const dataSent = lastLoaded > 0 ? progressEvent.loaded - lastLoaded : progressEvent.loaded
    lastLoaded = progressEvent.total === progressEvent.loaded ? 0 : progressEvent.loaded
    speedStack.push(dataSent / (currentStamp - lastTimestamp))

    lastTimestamp = currentStamp
  }

  const uploadChunk = async (chunkFile: File, offset: number) => {
    return new Promise((resolve, reject) => {
      if (!queueItem.fileId) {
        reject()
        return
      }
      damUploadChunk(
        damClient,
        queueItem,
        queueItem.fileId,
        chunkFile as unknown as string, // todo check
        chunkFile.size,
        offset,
        progressCallback
      )
        .then((result) => {
          resolve(result)
        })
        .catch((exception) => {
          reject(exception)
        })
    })
  }

  const processAndUploadChunk = async (offset: number): Promise<File> => {
    updateChunkSize(queueItem.progress.speed)
    let arrayBuffer = await readFile(offset, lastChunkSize.value, queueItem.file!)
    let chunkFile = new File([arrayBuffer.data], queueItem.file!.name)

    queueItem.currentChunkIndex = offset
    const cancelToken = axios.CancelToken
    queueItem.latestChunkCancelToken = cancelToken.source()

    let sleepTime = CHUNK_RETRY_INTERVAL
    let attempt = 0
    do {
      attempt++
      try {
        await uploadChunk(chunkFile, offset)
        assetAlgo.update(arrayBuffer.data)

        return chunkFile
      } catch (error) {
        // in error recompute
        if (axiosErrorResponseHasValidationData(error as Error)) {
          attempt = CHUNK_MAX_RETRY
          queueItem.error.message = handleValidationErrorMessage(error)
          return Promise.reject(error)
        }

        if (updateChunkSize(queueItem.progress.speed)) {
          arrayBuffer = await readFile(offset, lastChunkSize.value, queueItem.file!)
          chunkFile = new File([arrayBuffer.data], queueItem.file!.name)
        }

        await sleep(sleepTime)
        attempt === CHUNK_MAX_RETRY - 1 ? (sleepTime = 1) : (sleepTime *= CHUNK_RETRY_MULTIPLY)
      }
    } while (attempt < CHUNK_MAX_RETRY)
    return Promise.reject('Unable to upload chunk, max tries exceeded')
  }

  function speedCheck() {
    function speedCheckRun() {
      speedStack = speedStack.slice(-15)
      if (speedStack.length > 0) {
        const avgSpeed = Math.ceil(speedStack.reduce((sum, current) => sum + current) / speedStack.length)
        const remainingBytes = Math.ceil(fileSize.value * ((100 - progress.value) / 100))

        uploadCallback(progress.value, avgSpeed, Math.ceil(remainingBytes / avgSpeed))
      }

      if (endTimestamp === 0) {
        setTimeout(function () {
          speedCheckRun()
        }, SPEED_CHECK_INTERVAL)
      }
    }

    speedCheckRun()
  }

  const uploadInit = async () => {
    return new Promise((resolve, reject) => {
      if (!queueItem.file || queueItem.file.size < 1) {
        failUpload(queueItem)
        return
      }
      fileSize.value = queueItem.file.size
      queueItem.status = UploadQueueItemStatus.Uploading
      damUploadStart(damClient, queueItem)
        .then((res) => {
          queueItem.assetId = res.asset
          queueItem.fileId = res.id
          resolve(queueItem)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  const upload = async () => {
    if (uploadCallback) {
      speedCheck()
    }

    const filesize = queueItem.file?.size
    if (isUndefined(filesize)) return Promise.reject()

    let i = 0
    while (i < filesize) {
      const uploadedChunk = await processAndUploadChunk(i)
      i += uploadedChunk.size
      progress.value = (i / filesize) * 100
    }

    endTimestamp = Date.now() / 1000
    return await finishUpload(queueItem, assetAlgo.hex())
  }

  return {
    uploadInit,
    upload,
  }
}

export const uploadStop = (cancelTokenSource: CancelTokenSource) => {
  // todo stop speed check
  cancelTokenSource.cancel('axios request cancelled')
}
