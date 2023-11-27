import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { SYSTEM_CORE_DAM } from '@/services/api/coreDam/assetApi'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'
import { isNull } from '@/utils/common'

const END_POINT = '/adm/v1/asset'
const ENTITY = 'asset'
const BULK_METADATA_LIMIT = 10

export interface AssetMetadataBulkItem {
  id: DocId
  keywords: DocId[]
  authors: DocId[]
  described: boolean
  customData: AssetCustomData
}

export declare type AssetCustomData = Record<string, any>;

export const fetchAsset = (client: () => AxiosInstance, id: DocId) =>
  apiFetchOne<AssetDetailItemDto>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const bulkUpdateAssetsMetadata = (client: () => AxiosInstance, items: UploadQueueItem[]) => {
  return new Promise((resolve, reject) => {
    updateMetadataSequence(client, items)
      .then((responses) => {
        if (responses.length === 0) {
          reject(responses)
        } else if (
          responses.every((res) => {
            return res.status === HTTP_STATUS_OK
          })
        ) {
          resolve(responses)
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

async function updateMetadataSequence(client: () => AxiosInstance, items: UploadQueueItem[]) {
  const totalCalls = Math.ceil(items.length / BULK_METADATA_LIMIT)
  const bulkItems = listItemsToMetadataBulkItems(items)
  const responses = []
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
