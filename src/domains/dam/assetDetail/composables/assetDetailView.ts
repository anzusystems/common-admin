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

/** What the frame of the detail of an asset and of the dialog of a single upload draws, and nothing else. */
export interface AssetDetailView {
  /** Keys the sidebar; null while an upload has no asset yet (the sidebar then is not drawn). */
  id: DocId | null
  assetType: DamAssetTypeType
  assetStatus: DamAssetStatusType
  /** For the status props the sidebars take. */
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
    /** As the row has them (`UploadQueueItem['progress']`): not normalised. */
    progress?: number | null
    remainingTime?: number | null
  }
  /** The left side follows the region tab (which the sidebars offer by their own props). */
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
 * The picture is the grey placeholder of `AssetImage` (its last branch): no state of an upload and no file to show.
 * Only then does the box around it and its overlay take the whole area (finding 64); a picture keeps its own size.
 */
export const pictureIsPlaceholder = (view: AssetDetailView) =>
  !view.image.uploading &&
  !view.image.processing &&
  !view.image.waiting &&
  !(view.assetStatus === DamAssetStatus.WithFile && view.image.src)

/** The detail of an asset, as it is: the picture of its detail, no state of an upload. */
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
    // The editor follows the tab whatever the kind of the asset: the tabs of another kind have no region tab.
    roiEditorTab: true,
    simpleMode: simpleAssetSidebarEnabled && isImage,
  }
}

/**
 * The dialog of a single upload: what the row says of its asset until the upload is done, the asset the DAM read
 * after that; the preview of the row, its state and its progress.
 */
export function assetDetailViewOfUploadItem(
  item: UploadQueueItem | null,
  detailAsset: AssetDetailItemDto | null,
  options: { enableRoiTab: boolean; disableDoneAnimation: boolean; simpleAssetSidebarEnabled: boolean }
): AssetDetailView | null {
  if (!item) return null
  const done = item.status === UploadQueueItemStatus.Uploaded
  // The asset of this row only: the store it is read from is shared, and holds what another dialog or a pick from
  // the library left in it until the dialog has read its own.
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
