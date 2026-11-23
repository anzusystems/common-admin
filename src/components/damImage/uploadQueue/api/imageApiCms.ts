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
          ...(usageHolder ? { holderName: usageHolder.name, holderId: usageHolder.id } : {}),
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

const KNOWN_IMAGE_ERROR_CODES = ['image_take_over_failed', 'image_single_use_violation'] as const
export type KnownImageErrorCode = (typeof KNOWN_IMAGE_ERROR_CODES)[number]

// Mirrors the reasons of core-cms image_single_use_violation; an unknown reason falls back to the generic wording.
export const KNOWN_SINGLE_USE_REASONS = [
  'exclusivity_conflict',
  'shared_gallery',
  'invalid_owner',
  'gallery_copy',
  'restore_conflict',
] as const
export type KnownSingleUseReason = (typeof KNOWN_SINGLE_USE_REASONS)[number]

// `image_take_over_failed` carries its own reason vocabulary.
const KNOWN_REASONS = [
  ...KNOWN_SINGLE_USE_REASONS,
  'take_over_rejected',
  'take_over_exception',
] as const
export type KnownReason = (typeof KNOWN_REASONS)[number]

export interface ImageSaveErrorInfo {
  code: KnownImageErrorCode
  reason?: KnownReason
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
  if (!data || typeof data.error !== 'string') return undefined
  if (!(KNOWN_IMAGE_ERROR_CODES as readonly string[]).includes(data.error)) return undefined
  return {
    code: data.error as KnownImageErrorCode,
    reason:
      typeof data.reason === 'string' && (KNOWN_REASONS as readonly string[]).includes(data.reason)
        ? (data.reason as KnownReason)
        : undefined,
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
