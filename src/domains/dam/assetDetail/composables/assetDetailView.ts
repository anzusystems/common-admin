import {
  type AssetDetailItemDto,
  DamAssetStatus,
  DamAssetStatusDefault,
  type DamAssetStatusType,
  DamAssetType,
  DamAssetTypeDefault,
  type DamAssetTypeType,
} from '@/domains/dam/types/Asset'
import { type AssetFile, assetFileIsImageFile } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
} from '@/domains/dam/types/UploadQueue'
import type { DocId } from '@/shared/types/common'

/**
 * Exactly what the frame of the asset detail and the single-upload dialog renders.
 */
export interface AssetDetailView {
  /**
   * Keys the sidebar. Null while an upload has no asset yet, and then the sidebar is not rendered.
   */
  id: DocId | null
  assetType: DamAssetTypeType
  assetStatus: DamAssetStatusType
  /**
   * Used for the status props of the sidebars.
   */
  mainFile: AssetFile | null
  image: {
    src: string
    width?: number
    height?: number
    backgroundColor: string
    aspectRatio?: number
    uploading: boolean
    processing: boolean
    waiting: boolean
    done: boolean
    /**
     * As on the row (`UploadQueueItem['progress']`), not normalised.
     */
    progress?: number | null
    remainingTime?: number | null
  }
  /**
   * The left side follows the ROI tab. The sidebars offer that tab through their own props.
   */
  roiEditorTab: boolean
  simpleMode: boolean
}

const NO_COLOUR = '#ccc'
const IMAGE_ASPECT_RATIO = 16 / 9
const PROCESSING: readonly UploadQueueItemStatusType[] = [
  UploadQueueItemStatus.Processing,
  UploadQueueItemStatus.Loading,
]

const placeholder = () => ({ src: '', width: 356, height: 200, backgroundColor: NO_COLOUR })

const dominantColourOf = (mainFile: AssetFile | null | undefined) =>
  assetFileIsImageFile(mainFile) && mainFile.imageAttributes && mainFile.imageAttributes.mostDominantColor
    ? mainFile.imageAttributes.mostDominantColor
    : NO_COLOUR

/**
 * The image is the grey placeholder of `AssetImage` (its last branch): no upload state and no file.
 * Only then do the box and its overlay fill the whole area (finding 64). An image keeps its own size.
 */
export const pictureIsPlaceholder = (view: AssetDetailView) =>
  !view.image.uploading &&
  !view.image.processing &&
  !view.image.waiting &&
  !(view.assetStatus === DamAssetStatus.WithFile && view.image.src)

/**
 * View of an existing asset, without upload state.
 */
export function assetDetailViewOfAsset(
  asset: AssetDetailItemDto | null,
  simpleAssetSidebarEnabled: boolean
): AssetDetailView | null {
  if (!asset) return null
  const assetType = asset.attributes.assetType || DamAssetTypeDefault
  const isImage = assetType === DamAssetType.Image
  const detailPicture = asset.mainFile?.links?.image_detail
  return {
    id: asset.id,
    assetType,
    assetStatus: asset.attributes.assetStatus,
    mainFile: asset.mainFile || null,
    image: {
      ...(detailPicture
        ? {
            src: detailPicture.url,
            width: detailPicture.width,
            height: detailPicture.height,
            backgroundColor: dominantColourOf(asset.mainFile),
          }
        : placeholder()),
      uploading: false,
      processing: false,
      waiting: false,
      done: false,
    },
    // The editor follows the tab for any asset type. Other types have no ROI tab.
    roiEditorTab: true,
    simpleMode: simpleAssetSidebarEnabled && isImage,
  }
}

/**
 * View of the single-upload dialog: the row's asset data until the upload is done, then the asset read from the DAM.
 * Preview, state and progress come from the row.
 */
export function assetDetailViewOfUploadItem(
  item: UploadQueueItem | null,
  detailAsset: AssetDetailItemDto | null,
  options: { enableRoiTab: boolean; disableDoneAnimation: boolean; simpleAssetSidebarEnabled: boolean }
): AssetDetailView | null {
  if (!item) return null
  const done = item.status === UploadQueueItemStatus.Uploaded
  // Only this row's asset. The store is shared and may hold an asset left
  // by another dialog or a library pick until this dialog reads its own.
  const read = item.assetId && done && detailAsset?.id === item.assetId ? detailAsset : null
  const assetType =
    (read ? read.attributes.assetType : item.assetId ? item.assetType : undefined) || DamAssetTypeDefault
  const isImage = assetType === DamAssetType.Image
  const mainFile = read?.mainFile || null
  return {
    id: read ? read.id : item.assetId || null,
    assetType,
    assetStatus: read ? read.attributes.assetStatus : item.assetId ? item.assetStatus : DamAssetStatusDefault,
    mainFile,
    image: {
      ...(item.imagePreview
        ? {
            src: item.imagePreview.url,
            width: item.imagePreview.requestedWidth || undefined,
            height: item.imagePreview.requestedHeight || undefined,
            backgroundColor: dominantColourOf(mainFile),
          }
        : placeholder()),
      aspectRatio: IMAGE_ASPECT_RATIO,
      uploading: item.status === UploadQueueItemStatus.Uploading,
      processing: PROCESSING.includes(item.status),
      waiting: item.status === UploadQueueItemStatus.Waiting,
      done: !options.disableDoneAnimation && done,
      progress: item.progress.progressPercent,
      remainingTime: item.progress.remainingTime,
    },
    roiEditorTab: options.enableRoiTab,
    simpleMode: options.simpleAssetSidebarEnabled && isImage && options.enableRoiTab,
  }
}
