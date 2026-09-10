import axios, { type AxiosInstance } from 'axios'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { DocId, IntegerId } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'
import { isAnzuFatalError } from '@/model/error/AnzuFatalError'

const END_POINT = '/adm/v1/image'
export const ENTITY = 'image'
export const SYSTEM_CMS = 'cms'

const BULK_METADATA_LIMIT = 20

export const fetchImageListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<ImageAware[]>(client, ids, END_POINT, {}, SYSTEM_CMS, ENTITY)

export const fetchImage = (client: () => AxiosInstance, id: IntegerId) =>
  apiFetchOne<ImageAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const createImage = (client: () => AxiosInstance, data: ImageCreateUpdateAware) =>
  apiCreateOne<ImageCreateUpdateAware, ImageAware>(client, data, END_POINT, {}, SYSTEM_CMS, ENTITY)

export const updateImage = (
  client: () => AxiosInstance,
  id: IntegerId,
  data: ImageCreateUpdateAware,
) =>
  apiUpdateOne<ImageCreateUpdateAware, ImageAware>(
    client,
    data,
    END_POINT + '/:id',
    { id },
    SYSTEM_CMS,
    ENTITY,
  )

export const deleteImage = (client: () => AxiosInstance, id: IntegerId) =>
  apiDeleteOne<ImageAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

const KNOWN_IMAGE_ERROR_CODES = ['image_take_over_failed', 'image_single_use_violation'] as const
export type KnownImageErrorCode = (typeof KNOWN_IMAGE_ERROR_CODES)[number]

export interface ImageSaveErrorInfo {
  code: KnownImageErrorCode
  reason?: string
  damId?: DocId
  /** Empty when the holder cannot be named, which is the case for a gallery shared by two articles. */
  holderResourceName?: string
  holderResourceId?: string
}

/**
 * `apiCreateOne`/`apiUpdateOne` wrap every non-validation axios failure in `AnzuFatalError`, so the
 * take-over/single-use 422 bodies (not shaped like the generic `validation_failed` error) have to be
 * unwrapped from `cause` here rather than matched by the generic validation error class.
 */
export const extractImageSaveErrorInfo = (error: unknown): ImageSaveErrorInfo | undefined => {
  const axiosError = isAnzuFatalError(error)
    ? error.cause
    : axios.isAxiosError(error)
      ? error
      : undefined
  if (!axios.isAxiosError(axiosError)) return undefined
  const data = axiosError.response?.data
  if (!data || typeof data.error !== 'string') return undefined
  if (!(KNOWN_IMAGE_ERROR_CODES as readonly string[]).includes(data.error)) return undefined
  return {
    code: data.error as KnownImageErrorCode,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    damId: typeof data.damId === 'string' ? data.damId : undefined,
    holderResourceName:
      typeof data.holderResourceName === 'string' ? data.holderResourceName : undefined,
    holderResourceId: typeof data.holderResourceId === 'string' ? data.holderResourceId : undefined,
  }
}

export interface BulkUpdateImageFailure {
  item: ImageCreateUpdateAware
  index: number
  errorInfo?: ImageSaveErrorInfo
}

export interface BulkUpdateImagesResult {
  images: ImageAware[]
  failed: BulkUpdateImageFailure[]
}

/**
 * Each PUT chunk is atomic on the backend (all-or-nothing per request), so a failed chunk means
 * none of its items were persisted — every item in it is reported as failed. Only the item whose
 * damId the error body names (take-over/single-use violation) carries `errorInfo`: that one is the
 * culprit. The rest of the chunk failed only by being in the same request, so a caller offering to
 * drop the offending images must offer the items with `errorInfo` and re-send the others. Chunks are
 * processed sequentially and independently: one failing chunk doesn't stop the following ones.
 */
export const bulkUpdateImages = async (
  client: () => AxiosInstance,
  items: ImageCreateUpdateAware[],
): Promise<BulkUpdateImagesResult> => {
  const images: ImageAware[] = []
  const failed: BulkUpdateImageFailure[] = []
  if (items.length === 0) return { images, failed }

  const totalCalls = Math.ceil(items.length / BULK_METADATA_LIMIT)
  for (let i = 0; i < totalCalls; i++) {
    const offset = i * BULK_METADATA_LIMIT
    const reduced = items.slice(offset, offset + BULK_METADATA_LIMIT)
    try {
      const res = await client().put(END_POINT, JSON.stringify({ images: reduced }))
      if (res.status !== HTTP_STATUS_OK) {
        reduced.forEach((item, j) => failed.push({ item, index: offset + j }))
        continue
      }
      images.push(...(res.data.images as ImageAware[]))
    } catch (e) {
      const errorInfo = extractImageSaveErrorInfo(e)
      reduced.forEach((item, j) => {
        failed.push({
          item,
          index: offset + j,
          errorInfo: errorInfo && item.dam.damId === errorInfo.damId ? errorInfo : undefined,
        })
      })
    }
  }
  return { images, failed }
}
