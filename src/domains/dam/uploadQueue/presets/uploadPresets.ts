import type { AxiosProgressEvent } from 'axios'
import { commonT } from '@/plugins/i18n'
import type { DamUploadStartResponse, UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import type { DocId } from '@/shared/types/common'
import { damUploadChunk, damUploadFinish, damUploadStart } from '@/domains/dam/api/uploadApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { withTimeout } from '@/domains/listEditor/utils/listEditorLoader'

const HASH_LOAD_TIMEOUT = 15_000

export type UploadSide = 'library' | 'adminDam'
// Not exported from the library: only its own functions put them on a set or a run. Nothing reads the side at
// runtime; a set holds its members under the other one.
export const uploadSide = Symbol('uploadSide')
export const uploadPresetMembers = Symbol('uploadPresetMembers')

/** What a run asks the server. */
export interface UploadRunRequests {
  start(item: UploadQueueItem): Promise<DamUploadStartResponse>
  chunk(
    item: UploadQueueItem,
    fileId: DocId,
    chunk: File,
    size: number,
    offset: number,
    onUploadProgress: (event: AxiosProgressEvent) => void
  ): Promise<unknown>
  finish(item: UploadQueueItem, sha: string): Promise<unknown>
}

/** The texts a run writes into its row. Each side keeps its own. */
export interface UploadMessages {
  unknownError(): string
  /** A field the server refused, by its name. */
  size(): string
  offset(): string
  mimeType(): string
  /** Put before the name of a refused field there is no text for. */
  systemError(): string
  /** HTTP 400 on the last try of a chunk. */
  chunkValidationFailed(): string
}

export interface UploadHash {
  update(data: ArrayBuffer): unknown
  digest(encoding: 'hex'): string
}

interface UploadPresetMembers {
  requests: UploadRunRequests
  messages: UploadMessages
  apiTimeout: number | null | undefined
  loadHash(): Promise<UploadHash>
  /** Whether a file of no bytes is started and finished, or refused before anything is asked. */
  emptyFile: 'send' | 'reject'
  /** The DAM configuration whose prv configuration bounds the chunks, and whose last chunk size the upload starts from. */
  configName: string
}

/** How one side uploads. Made only by `libraryUploadPreset()` and `adminDamUploadPreset()`; what it holds is not public. */
export interface UploadPreset<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
  readonly [uploadPresetMembers]: UploadPresetMembers
}

export type UploadProgressCallback = (progress: number, speed: number, estimate: number) => void

export interface UploadRun<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
  uploadInit(): Promise<unknown>
  upload(): Promise<unknown>
  /** Stops the run wherever it is, and cancels the chunk on the wire. */
  stop(): void
  /** Whether the finish request went out: the server may complete the file whatever became of the answer. */
  finishAttempted(): boolean
}

/**
 * Not exported from `src/lib.ts`; the default of `useUpload` (under `default`). The library's API, texts and choices,
 * under the DAM configuration `configName`.
 */
export function libraryUploadPreset(configName: string): UploadPreset<'library'> {
  // A chunk is sized against the timeout the application gives the DAM requests of the configuration, else its root
  // one. One that gives none (`null` in a config file too) gets the default of the composable.
  const { damClient, endPointImage, apiTimeout } = useCommonAdminCoreDamOptions(configName)

  return {
    [uploadSide]: 'library',
    [uploadPresetMembers]: {
      requests: {
        start: (item) => damUploadStart(damClient, endPointImage, item),
        chunk: (item, fileId, chunk, size, offset, onUploadProgress) =>
          damUploadChunk(damClient, endPointImage, item, fileId, chunk, size, offset, onUploadProgress),
        finish: (item, sha) => damUploadFinish(damClient, endPointImage, item, sha),
      },
      messages: {
        unknownError: () => commonT('common.damImage.uploadErrors.unknownError'),
        size: () => commonT('common.damImage.uploadErrors.size'),
        offset: () => commonT('common.damImage.uploadErrors.offset'),
        mimeType: () => commonT('common.damImage.uploadErrors.mimeType'),
        systemError: () => commonT('common.damImage.uploadErrors.systemError'),
        chunkValidationFailed: () => commonT('common.damImage.uploadErrors.chunkValidationFailed'),
      },
      apiTimeout,
      // rusha is loaded when a file starts uploading, not with every page that shows the upload queue, and
      // before the asset is created: a chunk that does not arrive fails the item without an empty asset.
      loadHash: () =>
        withTimeout(import('rusha'), HASH_LOAD_TIMEOUT, `rusha did not load within ${HASH_LOAD_TIMEOUT} ms.`).then(
          (rusha) => rusha.default.createHash()
        ),
      emptyFile: 'reject',
      configName,
    },
  }
}

/** admin-dam's API, texts and choices. What is the application's own, the application hands in. */
export function adminDamUploadPreset(app: {
  /** `uploadStart`, `uploadChunk`, `uploadFinish` of `fileApi.ts`: four asset types, admin-dam's addresses. */
  requests: UploadRunRequests
  /** `system.uploadErrors.*`; as `chunkValidationFailed` its `unknownError`, which its store writes today. */
  messages: UploadMessages
  /** `envConfig.dam.apiTimeout`. */
  apiTimeout: number | null | undefined
  /** `() => Promise.resolve(rusha.createHash())`: rusha stays a static import of admin-dam. */
  loadHash(): Promise<UploadHash>
}): UploadPreset<'adminDam'> {
  return {
    [uploadSide]: 'adminDam',
    [uploadPresetMembers]: {
      requests: app.requests,
      messages: app.messages,
      apiTimeout: app.apiTimeout,
      loadHash: () => app.loadHash(),
      emptyFile: 'send',
      configName: 'default',
    },
  }
}
