import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { AssetSingleUseUsage } from '@/domains/dam/types/Asset'
import type { AssetSelectUsageHolder } from '@/domains/dam/types/AssetSelect'
import { HTTP_STATUS_OK } from '@/shared/statusCodes'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiFetchItems } from '@/domains/api/composables/useApiFetchItems'
import { useApiCommand, useApiRequest } from '@/domains/api/composables/useApiRequest'
import { isAnzuFatalError } from '@/shared/error/AnzuFatalError'
import { isAnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { isUndefined } from '@/shared/utils/common'

const END_POINT = '/adm/v1/image'
export const ENTITY = 'image'
export const SYSTEM_CMS = 'cms'

const BULK_METADATA_LIMIT = 20
const SINGLE_USE_USAGE_GROUP_LIMIT = 100

export const fetchImageListByIds = (client: () => AxiosInstance, ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<ImageAware>({
    client,
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute(ids)
}

// `optionalBody`: a body-less answer here means there is no image, not a broken endpoint.
// Callers guard the result with a strict `isNull`, so it is normalised to `null`.
export const fetchImage = async (client: () => AxiosInstance, id: IntegerId) => {
  const { execute } = useApiRequest<ImageAware, null>({
    client,
    method: 'GET',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
    optionalBody: true,
  })

  return (await execute({ urlParams: { id } })) ?? null
}

export const createImage = (client: () => AxiosInstance, data: ImageCreateUpdateAware) => {
  const { execute } = useApiRequest<ImageAware, ImageCreateUpdateAware>({
    client,
    method: 'POST',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute({ body: data })
}

export const updateImage = (client: () => AxiosInstance, id: IntegerId, data: ImageCreateUpdateAware) => {
  const { execute } = useApiRequest<ImageAware, ImageCreateUpdateAware>({
    client,
    method: 'PUT',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id }, body: data })
}

export const deleteImage = (client: () => AxiosInstance, id: IntegerId) => {
  const { execute } = useApiCommand({
    client,
    method: 'DELETE',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id } })
}

interface SingleUseUsageItem extends AssetSingleUseUsage {
  groupId: DocId
}

/**
 * Where each photo group is used, for the record `usageHolder` that picks (none: for no record), keyed by group id.
 * A group is the root file of a photo with the files taken over from it. Asked 100 groups per request, in parallel.
 */
export const fetchSingleUseUsage = async (
  client: () => AxiosInstance,
  groupIds: DocId[],
  usageHolder: AssetSelectUsageHolder | null
): Promise<Record<DocId, AssetSingleUseUsage>> => {
  const requests: Promise<SingleUseUsageItem[]>[] = []
  for (let offset = 0; offset < groupIds.length; offset += SINGLE_USE_USAGE_GROUP_LIMIT) {
    const { execute } = useApiFetchItems<SingleUseUsageItem>({
      client,
      system: SYSTEM_CMS,
      entity: ENTITY,
      urlTemplate: END_POINT + '/single-use-usage',
      options: {
        params: {
          groupIds: groupIds.slice(offset, offset + SINGLE_USE_USAGE_GROUP_LIMIT).join(','),
          ...(usageHolder
            ? { holderResourceName: usageHolder.resourceName, holderResourceId: usageHolder.resourceId }
            : {}),
        },
      },
    })
    requests.push(execute())
  }
  const usages: Record<DocId, AssetSingleUseUsage> = {}
  for (const items of await Promise.all(requests)) {
    for (const { groupId, ...usage } of items) {
      usages[groupId] = usage
    }
  }
  return usages
}

/** Error codes of core-cms refusing an image save (an image row of any record: article, gallery, person...). */
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
export type ImageSaveErrorReasonType = (typeof ImageSaveErrorReason)[keyof typeof ImageSaveErrorReason]

export interface ImageSaveErrorInfo {
  code: ImageSaveErrorCodeType
  reason?: ImageSaveErrorReasonType
  damId?: DocId
  holderResourceName?: string
  holderResourceId?: string
}

/**
 * The refusal of an image save by core-cms, from what a save rejected with: an error of the api helpers
 * (`AnzuApiAxiosError`, `AnzuFatalError`) or a bare axios error (`bulkUpdateImages`). `undefined` for any other.
 */
export const extractImageSaveErrorInfo = (error: unknown): ImageSaveErrorInfo | undefined => {
  const axiosError =
    isAnzuFatalError(error) || isAnzuApiAxiosError(error) ? error.cause : axios.isAxiosError(error) ? error : undefined
  if (!axios.isAxiosError(axiosError)) return undefined
  const data = axiosError.response?.data
  const code = Object.values(ImageSaveErrorCode).find((value) => value === data?.error)
  if (isUndefined(code)) return undefined
  return {
    code,
    reason: Object.values(ImageSaveErrorReason).find((value) => value === data.reason),
    damId: typeof data.damId === 'string' ? data.damId : undefined,
    holderResourceName: typeof data.holderResourceName === 'string' ? data.holderResourceName : undefined,
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
