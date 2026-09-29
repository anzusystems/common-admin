import { ref } from 'vue'
import axios from 'axios'
import { commonT } from '@/plugins/i18n'
import {
  type AnzuApiValidationResponseData,
  axiosErrorResponseHasValidationData,
} from '@/shared/error/AnzuApiValidationError'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { NEW_LINE_MARK } from '@/domains/system/composables/alerts'
import { isUndefined } from '@/shared/utils/common'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { damUploadChunk, damUploadFinish, damUploadStart } from '@/domains/dam/api/uploadApi'
import {
  useCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type Rusha from 'rusha'
import { withTimeout } from '@/domains/listEditor/utils/listEditorLoader'

// const CHUNK_MAX_RETRY = 6
const CHUNK_MAX_RETRY = 4
const SPEED_CHECK_INTERVAL = 1000
const CHUNK_RETRY_INTERVAL = 1000
const CHUNK_RETRY_MULTIPLY = 3
const HASH_LOAD_TIMEOUT = 15_000

// A call, not an inline comparison: TypeScript keeps a status narrowed across the awaits in between.
const isStopped = (queueItem: UploadQueueItem) => queueItem.status === UploadQueueItemStatus.Stop

const finishUpload = async (queueItem: UploadQueueItem, sha: string) => {
  const { damClient, endPointImage, endPointAsset } = useCommonAdminCoreDamOptions()
  const { uploadStatusFallback } = useCommonAdminCoreDamOptionsGlobal()
  return await damUploadFinish(damClient, endPointAsset, endPointImage, queueItem, sha, uploadStatusFallback)
}

const handleValidationErrorMessage = (error: Error | any) => {
  const t = commonT
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

const readFile = async (offset: number, size: number, file: File): Promise<{ data: ArrayBuffer; offset: number }> => {
  return new Promise((resolve, reject) => {
    const partial = file.slice(offset, offset + size)
    const reader = new FileReader()
    reader.onload = function (e) {
      if (e.target?.readyState === FileReader.DONE) {
        const result = e.target.result
        if (result instanceof ArrayBuffer) {
          resolve({ data: result, offset: offset })
        } else {
          reject(new Error('FileReader result is not an ArrayBuffer'))
        }
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
  const { damClient, endPointImage } = useCommonAdminCoreDamOptions()
  const fileSize = ref(0)

  const progress = ref(0)

  let speedStack: any[] = []
  let lastTimestamp = 0
  let endTimestamp = 0
  let lastLoaded = 0
  let speedCheckTimerId: ReturnType<typeof setTimeout> | null = null
  let sha: ReturnType<typeof Rusha.createHash> | undefined
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
        endPointImage,
        queueItem,
        queueItem.fileId,
        chunkFile,
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

  const processAndUploadChunk = async (offset: number, hash: ReturnType<typeof Rusha.createHash>): Promise<File> => {
    updateChunkSize(queueItem.progress.speed)
    let arrayBuffer: { data: ArrayBuffer; offset: number } = await readFile(
      offset,
      lastChunkSize.value,
      queueItem.file!
    )
    let chunkFile = new File([arrayBuffer.data], queueItem.file!.name, {
      type: queueItem.file!.type,
    })

    // Stop between chunks has no request to cancel: the controller below would be a fresh one.
    if (isStopped(queueItem)) return Promise.reject(new Error('Upload stopped'))
    queueItem.currentChunkIndex = offset
    queueItem.latestChunkAbortController = new AbortController()

    let sleepTime = CHUNK_RETRY_INTERVAL
    let attempt = 0
    do {
      attempt++
      try {
        await uploadChunk(chunkFile, offset)
        hash.update(arrayBuffer.data)

        return chunkFile
      } catch (error) {
        if (axios.isCancel(error) || isStopped(queueItem)) return Promise.reject(error)
        // Check for 400 Bad Request error on last attempt
        if (axios.isAxiosError(error) && error.response?.status === 400 && attempt >= CHUNK_MAX_RETRY) {
          queueItem.error.message = commonT('common.damImage.uploadErrors.chunkValidationFailed')
          return Promise.reject(error)
        }

        // in error recompute
        if (axiosErrorResponseHasValidationData(error as Error)) {
          attempt = CHUNK_MAX_RETRY
          queueItem.error.message = handleValidationErrorMessage(error)
          return Promise.reject(error)
        }

        if (updateChunkSize(queueItem.progress.speed)) {
          arrayBuffer = await readFile(offset, lastChunkSize.value, queueItem.file!)
          chunkFile = new File([arrayBuffer.data], queueItem.file!.name, {
            type: queueItem.file!.type,
          })
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
        speedCheckTimerId = setTimeout(function () {
          speedCheckRun()
        }, SPEED_CHECK_INTERVAL)
      }
    }

    speedCheckRun()
  }

  const stopSpeedCheck = () => {
    if (speedCheckTimerId !== null) {
      clearTimeout(speedCheckTimerId)
      speedCheckTimerId = null
    }
    endTimestamp = Date.now() / 1000
  }

  const uploadInit = async () => {
    // Taken before the first await, as it was before rusha loaded here: the queue starts every item it still
    // sees waiting, and it looks again after each file it adds.
    if (queueItem.file && queueItem.file.size > 0) queueItem.status = UploadQueueItemStatus.Uploading
    // rusha is loaded when a file starts uploading, not with every page that shows the upload queue, and
    // before the asset is created: a chunk that does not arrive fails the item without an empty asset.
    const rusha = await withTimeout(
      import('rusha'),
      HASH_LOAD_TIMEOUT,
      `rusha did not load within ${HASH_LOAD_TIMEOUT} ms.`
    )
    // Stop has no request to cancel while rusha loads, so it is checked once rusha is here.
    if (queueItem.status === UploadQueueItemStatus.Stop) throw new Error('Upload stopped')
    sha = rusha.default.createHash()
    return new Promise((resolve, reject) => {
      if (!queueItem.file || queueItem.file.size < 1) {
        reject(new Error('Empty file'))
        return
      }
      fileSize.value = queueItem.file.size
      queueItem.status = UploadQueueItemStatus.Uploading
      damUploadStart(damClient, endPointImage, queueItem)
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
    const hash = sha
    if (isUndefined(filesize) || isUndefined(hash)) return Promise.reject()
    // A stop while the asset was being created had no chunk request to cancel either.
    if (queueItem.status === UploadQueueItemStatus.Stop) return Promise.reject(new Error('Upload stopped'))

    let i = 0
    while (i < filesize) {
      const uploadedChunk = await processAndUploadChunk(i, hash)
      i += uploadedChunk.size
      progress.value = (i / filesize) * 100
    }

    endTimestamp = Date.now() / 1000
    if (isStopped(queueItem)) return Promise.reject(new Error('Upload stopped'))
    return await finishUpload(queueItem, hash.digest('hex'))
  }

  return {
    uploadInit,
    upload,
    stopSpeedCheck,
  }
}

export const uploadStop = (abortController: AbortController) => {
  abortController.abort()
}
