import type { AssetMetadataBulkItem } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import type { DocId, IntegerId } from '@/types/common'
import { isNull, isString, isUndefined } from '@/utils/common'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import type { AxiosInstance } from 'axios'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'

export interface UploadMetadataToImageMapItem extends ImageCreateUpdateAware {
  authorIds: DocId[]
  assetId: DocId | undefined
}

export type UploadMetadataToImageMapFn = (
  queueItems: UploadQueueItem[],
  bulkItems: AssetMetadataBulkItem[],
  damClient: () => AxiosInstance,
  extSystem: IntegerId,
  licenceId: IntegerId,
) => Promise<UploadMetadataToImageMapItem[]>

export type AssetSelectMetadataToImageMapFn = (assetRes: AssetDetailItemDto) => {
  description: string
  source: string
}

export async function mapUploadMetadataToImages(
  queueItems: UploadQueueItem[],
  bulkItems: AssetMetadataBulkItem[],
  damClient: () => AxiosInstance,
  extSystem: IntegerId,
  licenceId: IntegerId,
): Promise<UploadMetadataToImageMapItem[]> {
  // Build assetId -> { description, authorIds } map
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()

  bulkItems.forEach((bulkItem) => {
    assetMetadataMap.set(bulkItem.id, {
      description: isString(bulkItem.customData?.description)
        ? bulkItem.customData.description.trim()
        : '',
      authorIds: bulkItem.authors,
    })
  })

  // Collect unique author IDs and batch-fetch names only if needed
  const authorIdsToFetch = new Set<DocId>()
  assetMetadataMap.forEach((assetMeta) => {
    assetMeta.authorIds.forEach((authorId) => {
      authorIdsToFetch.add(authorId)
    })
  })

  const authorsMap = new Map<DocId, string>()
  if (authorIdsToFetch.size > 0) {
    const authorsRes = await fetchAuthorListByIds(damClient, extSystem, [...authorIdsToFetch])
    authorsRes.forEach((author) => {
      authorsMap.set(author.id, author.name)
    })
  }

  // Filter valid queue items and map to results
  const validItems = queueItems.filter(
    (queueItem) => !isNull(queueItem.assetId) && !isNull(queueItem.fileId),
  )

  return validItems.map((queueItem) => {
    const description = assetMetadataMap.get(queueItem.assetId!)?.description
    const authorIds = assetMetadataMap.get(queueItem.assetId!)?.authorIds
    const authorNames: string[] = []
    if (authorIds) {
      authorIds.forEach((authorId) => {
        const name = authorsMap.get(authorId)
        if (!isUndefined(name) && name.trim().length > 0) {
          authorNames.push(name)
        }
      })
    }

    return {
      texts: {
        description: description ?? '',
        source: authorNames.join(', '),
      },
      flags: {
        showSource: true,
        internal: false,
        overrideInternal: false,
      },
      dam: {
        damId: queueItem.fileId as DocId,
        regionPosition: 0,
        licenceId,
      },
      authorIds: authorIds || [],
      assetId: queueItem.assetId || undefined,
    }
  })
}
