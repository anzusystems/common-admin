import type { AxiosProgressEvent } from 'axios'
import { commonT } from '@/plugins/i18n'
import type { DamUploadStartResponse, UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import type { DocId } from '@/shared/types/common'
import { damUploadChunk, damUploadFinish, damUploadStart } from '@/domains/dam/api/uploadApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { withTimeout } from '@/domains/listEditor/utils/listEditorLoader'

const HASH_LOAD_TIMEOUT = 15_000

export type UploadSide = 'library' | 'adminDam'
// Not exported from the library, so only its own functions set them.
// Nothing reads the side at runtime. A preset holds its members under the other symbol.
export const uploadSide = Symbol('uploadSide')
export const uploadPresetMembers = Symbol('uploadPresetMembers')

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

/** Texts a run writes into its row. Each side has its own. */
export interface UploadMessages {
  unknownError(): string
  /** Text for a field the server refused, by field name. */
  size(): string
  offset(): string
  mimeType(): string
  /** Prefix for a refused field that has no text of its own. */
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
  /** Whether an empty file is started and finished, or refused before any request. */
  emptyFile: 'send' | 'reject'
  /** DAM configuration whose prv configuration bounds the chunks and whose last chunk size the upload starts from. */
  configName: string
}

/**
 * How one side uploads. Created only by `libraryUploadPreset()`
 * and `adminDamUploadPreset()`. Its contents are not public.
 */
export interface UploadPreset<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
  readonly [uploadPresetMembers]: UploadPresetMembers
}

export type UploadProgressCallback = (progress: number, speed: number, estimate: number) => void

export interface UploadRun<S extends UploadSide = UploadSide> {
  readonly [uploadSide]: S
  uploadInit(): Promise<unknown>
  upload(): Promise<unknown>
  /** Stops the run wherever it is and cancels the chunk in flight. */
  stop(): void
  /** Whether the finish request was sent. The server may complete the file whatever the response. */
  finishAttempted(): boolean
}

/**
 * Not exported from `src/lib.ts`. Default of `useUpload` (under `default`).
 * The library's API, texts and choices under DAM configuration `configName`.
 */
export function libraryUploadPreset(configName: string): UploadPreset<'library'> {
  // Chunks are sized against the app's DAM request timeout for this configuration, else the root one.
  // Without one (also `null` in a config file) the composable's default applies.
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
      // rusha loads when a file starts uploading, not on every page with the upload queue.
      // It loads before the asset is created, so a load failure fails the item without leaving an empty asset.
      loadHash: () =>
        withTimeout(import('rusha'), HASH_LOAD_TIMEOUT, `rusha did not load within ${HASH_LOAD_TIMEOUT} ms.`).then(
          (rusha) => rusha.default.createHash()
        ),
      emptyFile: 'reject',
      configName,
    },
  }
}

/** admin-dam's API, texts and choices. The application passes in its own parts. */
export function adminDamUploadPreset(app: {
  /** `uploadStart`, `uploadChunk`, `uploadFinish` of `fileApi.ts`: four asset types, admin-dam's addresses. */
  requests: UploadRunRequests
  /** `system.uploadErrors.*`. `chunkValidationFailed` uses its `unknownError`, which its store writes today. */
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
