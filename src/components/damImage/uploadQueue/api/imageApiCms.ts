import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { DocId, IntegerId } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import type { AssetSingleUseUsage } from '@/types/coreDam/Asset'
import type { AssetSelectUsageHolder } from '@/types/coreDam/AssetSelect'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'
import { isAnzuFatalError } from '@/model/error/AnzuFatalError'
import { isAnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { isUndefined } from '@/utils/common'

const END_POINT = '/adm/v1/image'
export const ENTITY = 'image'
export const SYSTEM_CMS = 'cms'

const BULK_METADATA_LIMIT = 20
const SINGLE_USE_USAGE_GROUP_LIMIT = 100

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

interface SingleUseUsageItem extends AssetSingleUseUsage {
  groupId: DocId
}

export const fetchSingleUseUsage = async (
  client: () => AxiosInstance,
  groupIds: DocId[],
  usageHolder: AssetSelectUsageHolder | null,
): Promise<Record<DocId, AssetSingleUseUsage>> => {
  const requests: Promise<AxiosResponse<{ data: SingleUseUsageItem[] }>>[] = []
  for (let offset = 0; offset < groupIds.length; offset += SINGLE_USE_USAGE_GROUP_LIMIT) {
    requests.push(
      client().get(END_POINT + '/single-use-usage', {
        params: {
          groupIds: groupIds.slice(offset, offset + SINGLE_USE_USAGE_GROUP_LIMIT).join(','),
          ...(usageHolder
            ? { holderResourceName: usageHolder.resourceName, holderResourceId: usageHolder.resourceId }
            : {}),
        },
      }),
    )
  }
  const usages: Record<DocId, AssetSingleUseUsage> = {}
  for (const response of await Promise.all(requests)) {
    for (const { groupId, ...usage } of response.data.data) {
      usages[groupId] = usage
    }
  }
  return usages
}

export const ImageSaveErrorCode = {
  TakeOverFailed: 'image_take_over_failed',
  SingleUseViolation: 'image_single_use_violation',
} as const
export type ImageSaveErrorCodeType = (typeof ImageSaveErrorCode)[keyof typeof ImageSaveErrorCode]

// Mirrors the reasons of core-cms; an unknown reason falls back to the generic wording.
export const ImageSaveErrorReason = {
  ExclusivityConflict: 'exclusivity_conflict',
  SharedGallery: 'shared_gallery',
  InvalidOwner: 'invalid_owner',
  GalleryCopy: 'gallery_copy',
  RestoreConflict: 'restore_conflict',
  TakeOverRejected: 'take_over_rejected',
  TakeOverException: 'take_over_exception',
} as const
export type ImageSaveErrorReasonType =
  (typeof ImageSaveErrorReason)[keyof typeof ImageSaveErrorReason]

export interface ImageSaveErrorInfo {
  code: ImageSaveErrorCodeType
  reason?: ImageSaveErrorReasonType
  damId?: DocId
  holderResourceName?: string
  holderResourceId?: string
}

export const extractImageSaveErrorInfo = (error: unknown): ImageSaveErrorInfo | undefined => {
  const axiosError =
    isAnzuFatalError(error) || isAnzuApiAxiosError(error)
      ? error.cause
      : axios.isAxiosError(error)
        ? error
        : undefined
  if (!axios.isAxiosError(axiosError)) return undefined
  const data = axiosError.response?.data
  const code = Object.values(ImageSaveErrorCode).find((value) => value === data?.error)
  if (isUndefined(code)) return undefined
  return {
    code,
    reason: Object.values(ImageSaveErrorReason).find((value) => value === data.reason),
    damId: typeof data.damId === 'string' ? data.damId : undefined,
    holderResourceName:
      typeof data.holderResourceName === 'string' ? data.holderResourceName : undefined,
    holderResourceId:
      typeof data.holderResourceId === 'string' || typeof data.holderResourceId === 'number'
        ? String(data.holderResourceId)
        : undefined,
  }
}

export const bulkUpdateImages = (client: () => AxiosInstance, items: ImageCreateUpdateAware[]) => {
  return new Promise<ImageAware[]>((resolve, reject) => {
    updateImagesSequence(client, items)
      .then((responses) => {
        if (items.length === 0) {
          return resolve([])
        } else if (responses.length === 0) {
          return reject(responses)
        } else if (
          responses.every((res) => {
            return res.status === HTTP_STATUS_OK
          })
        ) {
          const images: ImageAware[] = responses.flatMap((response) => response.data.images)
          return resolve(images)
        } else {
          return reject(responses)
        }
      })
      .catch((err) => {
        //
        return reject(err)
      })
  })
}

async function updateImagesSequence(client: () => AxiosInstance, items: ImageCreateUpdateAware[]) {
  const totalCalls = Math.ceil(items.length / BULK_METADATA_LIMIT)
  const responses: AxiosResponse[] = []
  if (items.length === 0) return Promise.resolve([])

  for (let i = 0; i < totalCalls; i++) {
    const offset = i * BULK_METADATA_LIMIT
    const reduced = items.slice(offset, offset + BULK_METADATA_LIMIT)
    const reqData = { images: reduced }
    const res = await client().put(END_POINT, JSON.stringify(reqData))
    responses.push(res)
  }
  return responses
}
