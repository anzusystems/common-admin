import type { AxiosInstance, AxiosResponse } from 'axios'
import type { DocId } from '@/types/common'
import type { AssetDetailItemDto, AssetSearchListItemDto } from '@/types/coreDam/Asset'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'
import { isNull } from '@/utils/common'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList } from '@/services/api/apiFetchList'
import type { ImageAware } from '@/types/ImageAware'

const END_POINT = '/adm/v1/asset'
const BULK_METADATA_LIMIT = 10
export const ENTITY = 'asset'
export const SYSTEM_CORE_DAM = 'coreDam'

export interface AssetMetadataBulkItem {
  id: DocId
  keywords: DocId[]
  authors: DocId[]
  described: boolean
  customData: AssetCustomData
}

export declare type AssetCustomData = Record<string, any>;

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
