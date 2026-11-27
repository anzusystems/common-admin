import type { AssetMetadataBulkItem } from '@/domains/dam/api/damAssetApi'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isNull, isString } from '@/shared/utils/common'
import { type DamCreditConfig, damCreditFromMap, fetchDamAuthorsMap } from '@/domains/dam/author/composables/damCredit'
import type { AxiosInstance } from 'axios'
import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import { createDamImage } from '@/domains/dam/imageWidget/utils/damImage'

export interface UploadMetadataToImageMapItem extends ImageCreateUpdateAware {
  authorIds: DocId[]
  sourceIds?: DocId[]
  assetId: DocId | undefined
}

export type UploadMetadataToImageMapFn = (
  queueItems: UploadQueueItem[],
  bulkItems: AssetMetadataBulkItem[],
  damClient: () => AxiosInstance,
  extSystem: IntegerId,
  licenceId: IntegerId
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
  endPointAuthor: string,
  creditConfig: DamCreditConfig
): Promise<UploadMetadataToImageMapItem[]> {
  // Build assetId -> { description, authorIds, sourceIds } map
  const assetMetadataMap = new Map<
    DocId,
    { description: string; authorIds: DocId[]; sourceIds: DocId[]; mainFileInternal: boolean }
  >()

  bulkItems.forEach((bulkItem) => {
    assetMetadataMap.set(bulkItem.id, {
      description: isString(bulkItem.customData?.description) ? bulkItem.customData.description.trim() : '',
      authorIds: bulkItem.authors,
      sourceIds: bulkItem.sources ?? [],
      mainFileInternal: bulkItem.mainFileInternal ?? false,
    })
  })

  // Batch-fetch the names of all sources and authors, only if there are any.
  const authorsMap = await fetchDamAuthorsMap(
    damClient,
    endPointAuthor,
    extSystem,
    [...assetMetadataMap.values()].flatMap((assetMeta) => [...assetMeta.authorIds, ...assetMeta.sourceIds])
  )

  // Filter valid queue items and map to results
  const validItems = queueItems.filter((queueItem) => !isNull(queueItem.assetId) && !isNull(queueItem.fileId))

  return validItems.map((queueItem) => {
    const description = assetMetadataMap.get(queueItem.assetId!)?.description
    const authorIds = assetMetadataMap.get(queueItem.assetId!)?.authorIds
    const sourceIds = assetMetadataMap.get(queueItem.assetId!)?.sourceIds
    const credit = damCreditFromMap(authorsMap, sourceIds, authorIds, creditConfig)

    return {
      ...createDamImage(
        {
          fileId: queueItem.fileId as DocId,
          licenceId,
          // For an asset not in the save answer, use its row value from the asset read.
          internal: (assetMetadataMap.get(queueItem.assetId!) ?? queueItem).mainFileInternal,
        },
        { description: description ?? '', source: credit }
      ),
      authorIds: authorIds || [],
      sourceIds: sourceIds || [],
      assetId: queueItem.assetId || undefined,
    }
  })
}
