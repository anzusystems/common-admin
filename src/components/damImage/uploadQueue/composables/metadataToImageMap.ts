import type { AssetMetadataBulkItem } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import type { DocId, IntegerId } from '@/types/common'
import { isNull, isString } from '@/utils/common'
import {
  damCreditFromMap,
  fetchDamAuthorsMap,
  getDamCreditConfig,
} from '@/components/damImage/uploadQueue/composables/damCredit'
import type { AxiosInstance } from 'axios'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'

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
  const assetMetadataMap = new Map<
    DocId,
    { description: string; authorIds: DocId[]; sourceIds: DocId[]; mainFileInternal: boolean }
  >()

  bulkItems.forEach((bulkItem) => {
    assetMetadataMap.set(bulkItem.id, {
      description: isString(bulkItem.customData?.description)
        ? bulkItem.customData.description.trim()
        : '',
      authorIds: bulkItem.authors,
      sourceIds: bulkItem.sources ?? [],
      mainFileInternal: bulkItem.mainFileInternal ?? false,
    })
  })

  const authorsMap = await fetchDamAuthorsMap(
    damClient,
    extSystem,
    [...assetMetadataMap.values()].flatMap((assetMeta) => [
      ...assetMeta.authorIds,
      ...assetMeta.sourceIds,
    ]),
  )

  // Filter valid queue items and map to results
  const validItems = queueItems.filter(
    (queueItem) => !isNull(queueItem.assetId) && !isNull(queueItem.fileId),
  )

  return validItems.map((queueItem) => {
    const description = assetMetadataMap.get(queueItem.assetId!)?.description
    const authorIds = assetMetadataMap.get(queueItem.assetId!)?.authorIds
    const sourceIds = assetMetadataMap.get(queueItem.assetId!)?.sourceIds

    return {
      texts: {
        description: description ?? '',
        source: damCreditFromMap(
          authorsMap,
          sourceIds ?? [],
          authorIds ?? [],
          getDamCreditConfig(extSystem),
        ),
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
        internal: assetMetadataMap.get(queueItem.assetId!)?.mainFileInternal ?? false,
      },
      authorIds: authorIds || [],
      sourceIds: sourceIds || [],
      assetId: queueItem.assetId || undefined,
    }
  })
}
