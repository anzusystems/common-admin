import { ref } from 'vue'
import axios from 'axios'
import {
  type AnzuApiValidationResponseData,
  axiosErrorResponseHasValidationData,
} from '@/shared/error/AnzuApiValidationError'
import { type UploadQueueItem, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { NEW_LINE_MARK } from '@/domains/system/composables/alerts'
import { isUndefined } from '@/shared/utils/common'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { useUploadMeter } from '@/domains/dam/uploadQueue/composables/uploadMeter'
import {
  libraryUploadPreset,
  type UploadHash,
  type UploadMessages,
  type UploadPreset,
  uploadPresetMembers,
  type UploadProgressCallback,
  type UploadRun,
  uploadSide,
  type UploadSide,
} from '@/domains/dam/uploadQueue/presets/uploadPresets'

// const CHUNK_MAX_RETRY = 6
const CHUNK_MAX_RETRY = 4
const CHUNK_RETRY_INTERVAL = 1000
const CHUNK_RETRY_MULTIPLY = 3

/** The text of a validation answer (422 with `fields`): one line per field, in the texts of the side. */
export function uploadValidationMessage(error: unknown, messages: UploadMessages): string {
  if (!axios.isAxiosError(error) || !error.response || !error.response.data) return messages.unknownError()
  const data = error.response.data as Partial<AnzuApiValidationResponseData>
  const errorMessages: string[] = []
  for (const [key, values] of Object.entries(data.fields ?? {})) {
    switch (key) {
      case 'size':
        errorMessages.push(messages.size())
        break
      case 'offset':
        errorMessages.push(messages.offset())
        break
      case 'mimeType':
        errorMessages.push(messages.mimeType())
        break
      default:
        errorMessages.push(messages.systemError() + ': ' + key + ' - ' + values.join(','))
    }
  }
  return errorMessages.length > 0 ? errorMessages.join(NEW_LINE_MARK) : messages.unknownError()
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

const stoppedError = () => new Error('Upload stopped')

/** One run for both sides; without a set it is the library's. Public as `useDamUpload`. */
export function useUpload(
  queueItem: UploadQueueItem,
  uploadCallback?: UploadProgressCallback,
  preset?: undefined
): UploadRun<'library'> & { stopSpeedCheck(): void }
/** The run of the side of the set. */
export function useUpload<S extends UploadSide>(
  queueItem: UploadQueueItem,
  uploadCallback: UploadProgressCallback | undefined,
  preset: UploadPreset<S>
): UploadRun<S> & { stopSpeedCheck(): void }
export function useUpload(
  queueItem: UploadQueueItem,
  uploadCallback?: UploadProgressCallback,
  preset?: UploadPreset
): UploadRun & { stopSpeedCheck(): void } {
  // Made only when none is given: it reads the options of the plugin, which a side with a set of its own need not
  // have.
  // Without a preset, as `useUpload` is public: the library's, under `default`.
  const set = preset ?? libraryUploadPreset('default')
  const { requests, messages, apiTimeout, loadHash, emptyFile, configName } = set[uploadPresetMembers]
  const fileSize = ref(0)

  const meter = useUploadMeter(uploadCallback)
  let sha: UploadHash | undefined
  // Once the finish request went out the server may complete the file, whatever becomes of the answer.
  let finishAttempted = false
  // Set by `stop()`; the queue may stop a run by the status of its row instead, and every check reads both.
  let stopRequested = false
  const { updateChunkSize, lastChunkSize } = useDamUploadChunkSize(apiTimeout ?? undefined, configName)

  // A call, not an inline comparison: TypeScript keeps a status narrowed across the awaits in between.
  const stopped = () => stopRequested || queueItem.status === UploadQueueItemStatus.Stop

  const uploadChunk = async (chunkFile: File, offset: number) => {
    return new Promise((resolve, reject) => {
      const onUploadProgress = meter.attempt(chunkFile.size)
      if (!queueItem.fileId) {
        reject()
        return
      }
      requests
        .chunk(queueItem, queueItem.fileId, chunkFile, chunkFile.size, offset, onUploadProgress)
        .then((result) => {
          resolve(result)
        })
        .catch((exception) => {
          reject(exception)
        })
    })
  }

  const processAndUploadChunk = async (offset: number, hash: UploadHash): Promise<File> => {
    if (stopped()) return Promise.reject(stoppedError())
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
    if (stopped()) return Promise.reject(stoppedError())
    queueItem.currentChunkIndex = offset
    queueItem.latestChunkAbortController = new AbortController()

    let sleepTime = CHUNK_RETRY_INTERVAL
    let attempt = 0
    do {
      attempt++
      try {
        await uploadChunk(chunkFile, offset)
        meter.chunkDone(chunkFile.size)
        hash.update(arrayBuffer.data)

        return chunkFile
      } catch (error) {
        meter.attemptFailed()
        if (axios.isCancel(error) || stopped()) return Promise.reject(error)
        const lastAttempt = attempt >= CHUNK_MAX_RETRY
        // Check for 400 Bad Request error on last attempt
        if (lastAttempt && axios.isAxiosError(error) && error.response?.status === 400) {
          queueItem.error.message = messages.chunkValidationFailed()
          return Promise.reject(error)
        }

        if (axiosErrorResponseHasValidationData(error as Error)) {
          queueItem.error.message = uploadValidationMessage(error, messages)
          return Promise.reject(error)
        }

        // Before the work for an attempt that never happens: the loop ends here.
        if (lastAttempt) break

        if (updateChunkSize(queueItem.progress.speed)) {
          arrayBuffer = await readFile(offset, lastChunkSize.value, queueItem.file!)
          chunkFile = new File([arrayBuffer.data], queueItem.file!.name, {
            type: queueItem.file!.type,
          })
        }

        await sleep(sleepTime)
        // A stop in the pause had no request to cancel.
        if (stopped()) return Promise.reject(stoppedError())
        sleepTime *= CHUNK_RETRY_MULTIPLY
      }
    } while (attempt < CHUNK_MAX_RETRY)
    return Promise.reject('Unable to upload chunk, max tries exceeded')
  }

  const stopSpeedCheck = () => meter.stop()

  const uploadInit = async () => {
    const sendable = !!queueItem.file && (emptyFile === 'send' || queueItem.file.size > 0)
    // Taken before the first await: the queue starts every item it still sees waiting, and it looks again after
    // each file it adds.
    if (sendable) queueItem.status = UploadQueueItemStatus.Uploading
    const hash = await loadHash()
    // Stop has no request to cancel while the hash is prepared, so it is checked once the hash is here.
    if (stopped()) throw stoppedError()
    sha = hash
    return new Promise((resolve, reject) => {
      if (!queueItem.file) {
        reject(new Error('uploadService: the queue item has no file'))
        return
      }
      if (!sendable) {
        reject(new Error('Empty file'))
        return
      }
      fileSize.value = queueItem.file.size
      queueItem.status = UploadQueueItemStatus.Uploading
      requests
        .start(queueItem)
        .then((res) => {
          // Without both identifiers there is nothing to send the chunks to, nor an asset to ask about: the
          // upload fails here, as when the start is refused, not after a round of tries that send nothing.
          if (!res?.id || !res?.asset) {
            reject(new Error('uploadService: the start answer names no file or no asset'))
            return
          }
          queueItem.assetId = res.asset
          queueItem.fileId = res.id
          // A stop asked for while this was on the wire; the asset it created stays on the server.
          if (stopped()) {
            reject(stoppedError())
            return
          }
          resolve(queueItem)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  const upload = async () => {
    meter.start(fileSize.value)

    // Every way out but the finish answered stops the meter: no later second reports on a run that failed.
    try {
      const filesize = queueItem.file?.size
      const hash = sha
      if (isUndefined(filesize) || isUndefined(hash)) throw undefined
      // A stop while the asset was being created had no chunk request to cancel either.
      if (stopped()) throw stoppedError()

      let i = 0
      while (i < filesize) {
        const uploadedChunk = await processAndUploadChunk(i, hash)
        i += uploadedChunk.size
      }

      meter.lastChunkSent()
      if (stopped()) throw stoppedError()
      finishAttempted = true
      return await requests.finish(queueItem, hash.digest('hex'))
    } catch (error) {
      stopSpeedCheck()
      throw error
    }
  }

  const stop = () => {
    stopRequested = true
    stopSpeedCheck()
    queueItem.latestChunkAbortController?.abort()
  }

  return {
    [uploadSide]: set[uploadSide],
    uploadInit,
    upload,
    stop,
    stopSpeedCheck,
    finishAttempted: () => finishAttempted,
  }
}

export const uploadStop = (abortController: AbortController) => {
  abortController.abort()
}
