import type { AxiosInstance, AxiosResponse } from 'axios'
import type { DocId, IntegerId } from '@/types/common'
import type { AssetDetailItemDto, AssetSearchListItemDto, DamAssetType } from '@/types/coreDam/Asset'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'
import { isNull, isUndefined } from '@/utils/common'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList } from '@/services/api/apiFetchList'
import {
  AnzuApiValidationError,
  type AnzuApiValidationResponseData,
  axiosErrorResponseHasValidationData,
  type ValidationError,
} from '@/model/error/AnzuApiValidationError'
import { useAlerts } from '@/composables/system/alerts'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'

const END_POINT = '/adm/v1/asset'
const BULK_METADATA_LIMIT = 10
export const ENTITY = 'asset'
export const SYSTEM_CORE_DAM = 'coreDam'
const FETCH_BY_IDS_MAX_LIMIT = 25

export interface AssetMetadataBulkItem {
  id: DocId
  keywords: DocId[]
  authors: DocId[]
  described: boolean
  customData: AssetCustomData
}

export declare type AssetCustomData = Record<string, any>

export const fetchAssetList = (
  client: () => AxiosInstance,
  licenceId: number,
  pagination: Pagination,
  filterBag: FilterBag
) =>
  apiFetchList<AssetSearchListItemDto[]>(
    client,
    END_POINT + '/licence/:licenceId',
    { licenceId },
    pagination,
    filterBag,
    SYSTEM_CORE_DAM,
    ENTITY
  )

export const fetchAsset = (client: () => AxiosInstance, id: DocId) =>
  apiFetchOne<AssetDetailItemDto>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const fetchAssetByFileId = (client: () => AxiosInstance, assetFileId: DocId) =>
  apiFetchOne<AssetDetailItemDto>(client, END_POINT + '/asset-file/:id', { id: assetFileId }, SYSTEM_CORE_DAM, ENTITY)

export const bulkUpdateAssetsMetadata = (client: () => AxiosInstance, items: UploadQueueItem[]) => {
  return new Promise<AssetMetadataBulkItem[]>((resolve, reject) => {
    const bulkItems = listItemsToMetadataBulkItems(items)
    updateMetadataSequence(client, bulkItems)
      .then((responses) => {
        if (bulkItems.length === 0) {
          return resolve([])
        } else if (responses.length === 0) {
          return reject(responses)
        } else if (
          responses.every((res) => {
            return res.status === HTTP_STATUS_OK
          })
        ) {
          const bulkItemsRes: AssetMetadataBulkItem[] = responses.flatMap(response => response.data)
          return resolve(bulkItemsRes)
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

async function fetchAssetListByIdsSequence(client: () => AxiosInstance, ids: DocId[], licenceId: number) {
  if (ids.length === 0) return Promise.resolve([])
  const totalCalls = Math.ceil(ids.length / FETCH_BY_IDS_MAX_LIMIT)
  const responses = []

  for (let i = 0; i < totalCalls; i++) {
    const offset = i * FETCH_BY_IDS_MAX_LIMIT
    const reduced = ids.slice(offset, offset + FETCH_BY_IDS_MAX_LIMIT)
    const res = await client().get(END_POINT + `/licence/${licenceId}/ids/${reduced.join(',')}`)
    responses.push(res)
  }
  return responses
}

export const fetchAssetListByIds: (
  client: () => AxiosInstance,
  ids: DocId[],
  licenceId: number
) => Promise<AssetDetailItemDto[]> = (client: () => AxiosInstance, ids: DocId[], licenceId: number) => {
  return new Promise((resolve, reject) => {
    fetchAssetListByIdsSequence(client, ids, licenceId)
      .then((responses) => {
        if (ids.length === 0) {
          return resolve([])
        } else if (responses.length === 0) {
          reject(responses)
        } else if (
          responses.every((res) => {
            return res.status === HTTP_STATUS_OK
          })
        ) {
          const final = []
          for (let i = 0; i < responses.length; i++) {
            final.push(...responses[i].data.data)
          }
          resolve(final as AssetDetailItemDto[])
        } else {
          reject(responses)
        }
      })
      .catch((err) => {
        //
        reject(err)
      })
  })
}

async function updateMetadataSequence(client: () => AxiosInstance, bulkItems: AssetMetadataBulkItem[]) {
  const totalCalls = Math.ceil(bulkItems.length / BULK_METADATA_LIMIT)
  const responses: AxiosResponse[] = []
  if (bulkItems.length === 0) return Promise.resolve([])

  for (let i = 0; i < totalCalls; i++) {
    const offset = i * BULK_METADATA_LIMIT
    const reduced = bulkItems.slice(offset, offset + BULK_METADATA_LIMIT)
    const res = await client().patch(END_POINT + '/metadata-bulk-update', JSON.stringify(reduced))
    responses.push(res)
  }
  return responses
}

function listItemsToMetadataBulkItems (items: UploadQueueItem[]) {
  const dtoItems: AssetMetadataBulkItem[] = []
  items.forEach((item) => {
    if (!isNull(item.assetId) && item.canEditMetadata) {
      dtoItems.push({
        id: item.assetId,
        keywords: item.keywords,
        authors: item.authors,
        described: true,
        customData: item.customData,
      })
    }
  })

  return dtoItems
}

const { showUnknownError, showApiValidationError } = useAlerts()

const handleMetadataValidationError = (error: any, assetType: DamAssetType, extSystem: IntegerId) => {
  const { getDamConfigAssetCustomFormElements } = useDamConfigState()
  const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(extSystem)
  if (isUndefined(configAssetCustomFormElements)) {
    throw new Error('Custom form elements must be initialised.')
  }
  if (!error || !error.response || !error.response.data) return
  const data = error.response.data as AnzuApiValidationResponseData
  const items = [] as ValidationError[]
  for (const [key, values] of Object.entries(data.fields)) {
    const field = key.split('.').pop()
    const found = configAssetCustomFormElements[assetType].find((item) => item.property === field)
    if (found) {
      items.push({
        field: found.name,
        errors: values,
      })
    }
  }
  if (items.length) {
    showApiValidationError(items, -1, true)
    return
  }
  showUnknownError()
}

export const updateAssetMetadata = (client: () => AxiosInstance, asset: AssetDetailItemDto, extSystem: IntegerId) => {
  return new Promise((resolve, reject) => {
    const data = {
      id: asset.id,
      keywords: asset.keywords,
      authors: asset.authors,
      described: true,
      customData: asset.metadata.customData,
    }
    client()
      .patch(END_POINT + '/metadata-bulk-update', JSON.stringify([data]))
      .then((res) => {
        if (res.status === HTTP_STATUS_OK) {
          resolve(res.data)
        } else {
          //
          reject()
        }
      })
      .catch((err) => {
        if (axiosErrorResponseIsForbidden(err)) {
          return reject(new AnzuApiForbiddenError(err))
        }
        if (axiosErrorResponseHasValidationData(err)) {
          handleMetadataValidationError(err, asset.attributes.assetType, extSystem)
          return reject(new AnzuApiValidationError(err, SYSTEM_CORE_DAM, ENTITY, err))
        }
        if (axiosErrorResponseHasForbiddenOperationData(err)) {
          return reject(new AnzuApiForbiddenOperationError(err, err))
        }
        return reject(new AnzuFatalError(err))
      })
  })
}
